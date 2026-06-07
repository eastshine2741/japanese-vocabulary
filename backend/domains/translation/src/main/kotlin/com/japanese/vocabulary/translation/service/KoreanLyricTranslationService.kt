package com.japanese.vocabulary.translation.service

import com.japanese.vocabulary.observability.MetricNames
import com.japanese.vocabulary.translation.client.gemini.GeminiClient
import com.japanese.vocabulary.song.entity.KoreanLyricStatus
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.song.model.Token
import com.japanese.vocabulary.translation.model.TokenInfo
import com.japanese.vocabulary.song.repository.LyricRepository
import io.micrometer.core.instrument.Gauge
import io.micrometer.core.instrument.MeterRegistry
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import org.slf4j.LoggerFactory
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * Domain-level lyric translation operations. Exposes granular methods over a single [LyricEntity];
 * the polling / batching / coroutine / retry-policy flow lives in
 * `batch.KoreanLyricTranslationScheduler`, which composes these primitives.
 */
@Service
class KoreanLyricTranslationService(
    private val lyricRepository: LyricRepository,
    private val morphologicalAnalyzer: MorphologicalAnalyzer,
    private val geminiClient: GeminiClient,
    private val meterRegistry: MeterRegistry,
) {
    private val logger = LoggerFactory.getLogger("KoreanLyricTranslation")

    init {
        registerStatusGauge(KoreanLyricStatus.PENDING, MetricNames.LYRIC_TRANSLATION_PENDING)
        registerStatusGauge(KoreanLyricStatus.PROCESSING, MetricNames.LYRIC_TRANSLATION_PROCESSING)
        registerStatusGauge(KoreanLyricStatus.FAILED, MetricNames.LYRIC_TRANSLATION_FAILED)
    }

    private fun registerStatusGauge(status: KoreanLyricStatus, name: String) {
        Gauge.builder(name) { lyricRepository.countByStatus(status).toDouble() }
            .register(meterRegistry)
    }

    @Transactional(readOnly = true)
    fun findPendingLyrics(limit: Int): List<LyricEntity> =
        lyricRepository.findNextForTranslation(
            listOf(KoreanLyricStatus.PENDING),
            Pageable.ofSize(limit),
        )

    @Transactional
    fun markProcessing(entities: List<LyricEntity>) {
        if (entities.isEmpty()) return
        entities.forEach { entity ->
            logger.info("[songId={}] Status: {} → PROCESSING", entity.songId, entity.status)
            entity.status = KoreanLyricStatus.PROCESSING
        }
        lyricRepository.saveAllAndFlush(entities)
    }

    /**
     * Pure compute: morphological analysis + Gemini calls + token merge. No DB writes.
     * Throws on failure so the caller can decide retry vs terminal-fail policy.
     */
    suspend fun runPipeline(entity: LyricEntity): List<AnalyzedLine> {
        logger.info(
            "[songId={}] Starting translation (retryCount={})",
            entity.songId, entity.retryCount,
        )

        val lyricLines = entity.rawContent
        logger.info("[songId={}] Parsed {} lyric lines", entity.songId, lyricLines.size)

        // 1. Morphological analysis (Kuromoji IPADic + UniDic ensemble)
        val lineTokensMap = lyricLines.associate { line ->
            line.index to morphologicalAnalyzer.analyze(line.text)
        }

        // 2. Build inputs for the two parallel Gemini calls
        val translationInput = lyricLines.map { line ->
            mapOf("index" to line.index, "text" to line.text)
        }

        // Slim input matches playground: only {index, words: [{baseForm}]}.
        // text/surface/pos were observed to mislead the LLM in offline eval.
        val wordMeaningInput = lyricLines.map { line ->
            val tokens = lineTokensMap[line.index] ?: emptyList()
            val words = tokens.filter { !isSkippableToken(it) }.map { token ->
                mapOf("baseForm" to token.baseForm)
            }
            mapOf("index" to line.index, "words" to words)
        }

        // 3. Call Gemini APIs in parallel: translation (pro) + word meanings (flash-lite)
        logger.info("[songId={}] Calling Gemini APIs in parallel...", entity.songId)
        val (translated, wordMeanings) = coroutineScope {
            val translationDeferred = async { geminiClient.translateLyrics(translationInput) }
            val wordMeaningDeferred = async { geminiClient.lookupWordMeanings(wordMeaningInput) }
            translationDeferred.await() to wordMeaningDeferred.await()
        }
        logger.info(
            "[songId={}] Gemini responded: {} translated, {} word-meaning lines",
            entity.songId, translated.size, wordMeanings.size,
        )

        // 4. Merge ensemble tokens + translation + word meanings → AnalyzedLine
        val translationMap = translated.associateBy { it.index }
        val wordMeaningMap = wordMeanings.associateBy { it.index }

        return lyricLines.map { line ->
            val tokens = lineTokensMap[line.index] ?: emptyList()
            val translation = translationMap[line.index]
            val meanings = wordMeaningMap[line.index]

            /*
             * 1:1 sequential matching between ensemble tokens and LLM word meanings.
             * The LLM prompt enforces strict 1:1 correspondence with input words (no merge/split).
             * SYMBOL tokens were filtered before sending to LLM, so a separate index advances
             * only for non-skippable tokens.
             * charStart/charEnd come directly from the ensemble analyzer.
             */
            val meaningWords = meanings?.words ?: emptyList()
            var meaningIdx = 0

            val mergedTokens = tokens.map { tokenInfo ->
                val koreanText = if (!isSkippableToken(tokenInfo) && meaningIdx < meaningWords.size) {
                    val meaning = meaningWords[meaningIdx]
                    meaningIdx++
                    meaning.koreanText
                } else {
                    null
                }

                // Prompt enforces verbatim baseForm; use analyzer's value as the
                // source of truth and do not trust LLM-side mutations.
                Token(
                    surface = tokenInfo.surface,
                    baseForm = tokenInfo.baseForm,
                    reading = tokenInfo.reading,
                    baseFormReading = tokenInfo.baseFormReading,
                    partOfSpeech = if (isSkippableToken(tokenInfo)) PartOfSpeech.SYMBOL else tokenInfo.partOfSpeech,
                    charStart = tokenInfo.charStart,
                    charEnd = tokenInfo.charEnd,
                    koreanText = koreanText,
                )
            }

            AnalyzedLine(
                index = line.index,
                koreanLyrics = translation?.koreanLyrics,
                koreanPronounciation = translation?.koreanPronounciation,
                tokens = mergedTokens,
            )
        }
    }

    @Transactional
    fun markCompleted(entity: LyricEntity, lines: List<AnalyzedLine>) {
        entity.analyzedContent = lines
        entity.status = KoreanLyricStatus.COMPLETED
        lyricRepository.save(entity)
        logger.info("[songId={}] Status: PROCESSING → COMPLETED", entity.songId)
    }

    /**
     * Increments [LyricEntity.retryCount] and resets status to PENDING for another attempt.
     * Returns the new retry count so the caller can decide whether to mark FAILED.
     */
    @Transactional
    fun recordRetryAttempt(entity: LyricEntity): Int {
        entity.retryCount++
        entity.status = KoreanLyricStatus.PENDING
        lyricRepository.save(entity)
        logger.info(
            "[songId={}] Status: PROCESSING → PENDING (retry attempt {})",
            entity.songId, entity.retryCount,
        )
        return entity.retryCount
    }

    @Transactional
    fun markFailed(entity: LyricEntity) {
        entity.status = KoreanLyricStatus.FAILED
        lyricRepository.save(entity)
        logger.info("[songId={}] Status: PROCESSING → FAILED (terminal)", entity.songId)
    }

    private companion object {
        /**
         * Tokens whose surface contains no Japanese characters should not be sent to the LLM.
         *
         * WHY SURFACE-BASED (not POS-based):
         * - kuromoji-unidic misclassifies some hiragana/katakana as SYMBOL (OOV handling).
         * - kuromoji classifies ASCII symbols like " and [ as NOUN (OOV handling).
         * Checking the actual surface characters handles both directions of misclassification.
         */
        private val JAPANESE_REGEX = Regex("[぀-ゟ゠-ヿ一-鿿㐀-䶿ｦ-ﾟ]")

        private fun isSkippableToken(token: TokenInfo): Boolean =
            !JAPANESE_REGEX.containsMatchIn(token.surface)
    }
}
