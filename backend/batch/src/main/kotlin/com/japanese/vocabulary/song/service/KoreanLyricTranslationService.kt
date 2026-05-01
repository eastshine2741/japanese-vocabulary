package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.song.client.gemini.GeminiClient
import com.japanese.vocabulary.song.dto.AnalyzedLine
import com.japanese.vocabulary.song.dto.Token
import com.japanese.vocabulary.song.dto.PartOfSpeech
import com.japanese.vocabulary.song.dto.TokenInfo
import com.japanese.vocabulary.song.entity.KoreanLyricStatus
import com.japanese.vocabulary.song.repository.LyricRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import org.slf4j.LoggerFactory
import org.springframework.data.domain.Pageable
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import org.springframework.transaction.support.TransactionTemplate
@Service
class KoreanLyricTranslationService(
    private val lyricRepository: LyricRepository,
    private val morphologicalAnalyzer: MorphologicalAnalyzer,
    private val geminiClient: GeminiClient,
    private val transactionTemplate: TransactionTemplate,
) {
    private val logger = LoggerFactory.getLogger("KoreanLyricTranslation")
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    companion object {
        private const val MAX_RETRIES = 3
        private const val BATCH_SIZE = 5

        /**
         * Tokens whose surface contains no Japanese characters should not be sent to the LLM.
         *
         * WHY SURFACE-BASED (not POS-based):
         * - kuromoji-unidic misclassifies some hiragana/katakana as SYMBOL (OOV handling).
         * - kuromoji classifies ASCII symbols like " and [ as NOUN (OOV handling).
         * Checking the actual surface characters handles both directions of misclassification.
         */
        private val JAPANESE_REGEX = Regex("[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF\uFF66-\uFF9F]")

        private fun isSkippableToken(token: TokenInfo): Boolean {
            return !JAPANESE_REGEX.containsMatchIn(token.surface)
        }
    }

    @Scheduled(fixedRate = 30_000)
    fun processTranslations() {
        logger.info("Polling for next translation batch...")

        val batch = transactionTemplate.execute {
            val entities = lyricRepository.findNextForTranslation(
                listOf(KoreanLyricStatus.PENDING),
                Pageable.ofSize(BATCH_SIZE)
            )
            if (entities.isNotEmpty()) {
                entities.forEach { entity ->
                    logger.info("[songId={}] Status: {} → PROCESSING", entity.songId, entity.status)
                    entity.status = KoreanLyricStatus.PROCESSING
                }
                lyricRepository.saveAllAndFlush(entities)
            }
            entities
        } ?: emptyList()

        if (batch.isEmpty()) {
            logger.info("No pending translations found")
            return
        }

        logger.info("Found {} songs to translate, dispatching to IO", batch.size)

        scope.launch {
            val results = batch.map { lyricEntity ->
                async { translateOne(lyricEntity) }
            }.awaitAll()

            val succeeded = results.count { it }
            val failed = results.size - succeeded
            logger.info("Batch complete: {} succeeded, {} failed out of {} total", succeeded, failed, results.size)
        }
    }

    private suspend fun translateOne(lyricEntity: com.japanese.vocabulary.song.entity.LyricEntity): Boolean {
        logger.info(
            "[songId={}] Starting translation (retryCount={})",
            lyricEntity.songId, lyricEntity.retryCount
        )

        return try {
            val lyricLines = lyricEntity.rawContent
            logger.info("[songId={}] Parsed {} lyric lines", lyricEntity.songId, lyricLines.size)

            // 1. Morphological analysis (Kuromoji IPADic + UniDic ensemble)
            val lineTokensMap = lyricLines.associate { line ->
                line.index to morphologicalAnalyzer.analyze(line.text)
            }

            // 2. Build inputs for two parallel Gemini calls
            val translationInput = lyricLines.map { line ->
                mapOf("index" to line.index, "text" to line.text)
            }

            val wordMeaningInput = lyricLines.map { line ->
                val tokens = lineTokensMap[line.index] ?: emptyList()
                val words = tokens.filter { !isSkippableToken(it) }.map { token ->
                    mapOf("surface" to token.surface, "baseForm" to token.baseForm, "pos" to token.partOfSpeech.name)
                }
                mapOf("index" to line.index, "text" to line.text, "words" to words)
            }

            // 3. Call Gemini APIs in parallel: translation (pro) + word meanings (flash-lite)
            logger.info("[songId={}] Calling Gemini APIs in parallel...", lyricEntity.songId)
            val (translated, wordMeanings) = coroutineScope {
                val translationDeferred = async { geminiClient.translateLyrics(translationInput) }
                val wordMeaningDeferred = async { geminiClient.lookupWordMeanings(wordMeaningInput) }
                translationDeferred.await() to wordMeaningDeferred.await()
            }
            logger.info(
                "[songId={}] Gemini responded: {} translated, {} word-meaning lines",
                lyricEntity.songId, translated.size, wordMeanings.size
            )

            // 4. Merge: ensemble tokens + translation + word meanings → AnalyzedLine
            val translationMap = translated.associateBy { it.index }
            val wordMeaningMap = wordMeanings.associateBy { it.index }

            val analyzedLines = lyricLines.map { line ->
                val tokens = lineTokensMap[line.index] ?: emptyList()
                val translation = translationMap[line.index]
                val meanings = wordMeaningMap[line.index]

                /*
                 * Merge logic: 1:1 sequential matching between ensemble tokens and LLM word meanings.
                 *
                 * The LLM prompt enforces strict 1:1 correspondence with input words (no merge/split).
                 * SYMBOL tokens were filtered before sending to LLM, so we track a separate index
                 * for LLM words and only advance it for non-skippable tokens.
                 *
                 * charStart/charEnd come directly from the ensemble analyzer — no recalculation needed.
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

                    // Use LLM-corrected baseForm if available
                    val correctedBaseForm = if (!isSkippableToken(tokenInfo) && meaningIdx - 1 >= 0 && meaningIdx - 1 < meaningWords.size) {
                        meaningWords[meaningIdx - 1].baseForm
                    } else {
                        tokenInfo.baseForm
                    }

                    Token(
                        surface = tokenInfo.surface,
                        baseForm = correctedBaseForm,
                        reading = tokenInfo.reading,
                        baseFormReading = tokenInfo.baseFormReading,
                        partOfSpeech = if (isSkippableToken(tokenInfo)) PartOfSpeech.SYMBOL else tokenInfo.partOfSpeech,
                        charStart = tokenInfo.charStart,
                        charEnd = tokenInfo.charEnd,
                        koreanText = koreanText
                    )
                }

                AnalyzedLine(
                    index = line.index,
                    koreanLyrics = translation?.koreanLyrics,
                    koreanPronounciation = translation?.koreanPronounciation,
                    tokens = mergedTokens
                )
            }

            // 5. Save result
            lyricEntity.analyzedContent = analyzedLines
            lyricEntity.status = KoreanLyricStatus.COMPLETED
            lyricRepository.save(lyricEntity)
            logger.info("[songId={}] Status: PROCESSING → COMPLETED", lyricEntity.songId)
            true
        } catch (e: Exception) {
            lyricEntity.retryCount++
            if (lyricEntity.retryCount >= MAX_RETRIES) {
                lyricEntity.status = KoreanLyricStatus.FAILED
                lyricRepository.save(lyricEntity)
                logger.error(
                    "[songId={}] Translation failed (attempt {}/{}): {}",
                    lyricEntity.songId, lyricEntity.retryCount, MAX_RETRIES, e.message
                )
                logger.error("[songId={}] Status: PROCESSING → FAILED (max retries reached)", lyricEntity.songId)
            } else {
                lyricEntity.status = KoreanLyricStatus.PENDING
                lyricRepository.save(lyricEntity)
                logger.error(
                    "[songId={}] Translation failed (attempt {}/{}): {}",
                    lyricEntity.songId, lyricEntity.retryCount, MAX_RETRIES, e.message
                )
                logger.info("[songId={}] Status: PROCESSING → PENDING (will retry)", lyricEntity.songId)
            }
            false
        }
    }
}
