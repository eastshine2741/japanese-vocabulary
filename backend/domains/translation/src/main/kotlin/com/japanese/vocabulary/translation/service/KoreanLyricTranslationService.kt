package com.japanese.vocabulary.translation.service

import com.japanese.vocabulary.observability.MetricNames
import com.japanese.vocabulary.translation.client.gemini.GeminiClient
import com.japanese.vocabulary.translation.client.gemini.dto.CorrWordDto
import com.japanese.vocabulary.translation.client.gemini.dto.SegLineDto
import com.japanese.vocabulary.translation.client.gemini.dto.TranslationResultDto
import com.japanese.vocabulary.translation.client.jisho.JishoClient
import com.japanese.vocabulary.translation.client.jisho.JishoPartOfSpeechMapper
import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryDto
import com.japanese.vocabulary.song.entity.KoreanLyricStatus
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.Token
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
 *
 * The word-meaning pipeline is the confirmed L3 + translation-grounded-correction harness
 * (Kuromoji dropped). See [runPipeline].
 */
@Service
class KoreanLyricTranslationService(
    private val lyricRepository: LyricRepository,
    private val geminiClient: GeminiClient,
    private val jishoClient: JishoClient,
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
     * Pure compute: the confirmed word-meaning pipeline. No DB writes.
     * Throws on failure so the caller can decide retry vs terminal-fail policy.
     *
     * Stages (all word-meaning calls use the lightweight model):
     *  1. **segment+lemmatize** (LLM): raw line → [{surface, dictionaryForm, reading}].
     *  2. in parallel with (1)'s downstream:
     *     - **translation** (pro): line → koreanLyrics + koreanPronounciation.
     *     - **jisho grounding + meaning** (LLM): unique dictionaryForms → EN senses/POS/JLPT → koreanText.
     *  3. **correction** (LLM): uses the finished Korean translation as source-of-truth to fix
     *     context-wrong meanings + segmentation errors.
     *  4. **assemble**: corrected words → [Token] with charStart/charEnd recomputed via sequential
     *     indexOf, POS from jisho, jlpt from jisho.
     */
    suspend fun runPipeline(entity: LyricEntity): List<AnalyzedLine> {
        logger.info(
            "[songId={}] Starting translation (retryCount={})",
            entity.songId, entity.retryCount,
        )

        val lyricLines = entity.rawContent
        logger.info("[songId={}] Parsed {} lyric lines", entity.songId, lyricLines.size)

        val lineInput = lyricLines.map { mapOf("index" to it.index, "text" to it.text) }

        // Translation (pro) runs in parallel with the [segment → jisho → meaning] chain.
        logger.info("[songId={}] Calling Gemini APIs (translation ∥ segment→meaning)...", entity.songId)
        val parts = coroutineScope {
            val translationDeferred = async { geminiClient.translateLyrics(lineInput) }
            val meaningDeferred = async {
                val seg = geminiClient.segmentAndLemmatize(lineInput)
                val dictForms = seg.flatMap { it.words }.map { it.dictionaryForm }.distinct()
                val jishoData = jishoClient.lookupAll(dictForms)
                val meaningInput = dictForms.map { df ->
                    val j = jishoData[df]
                    mapOf(
                        "dictionaryForm" to df,
                        "jishoPos" to (j?.pos ?: emptyList<String>()),
                        "jishoSenses" to (j?.senses ?: emptyList<String>()),
                        "jlpt" to (j?.jlpt ?: emptyList<String>()),
                    )
                }
                val meanings = geminiClient.translateMeanings(meaningInput)
                Triple(seg, jishoData, meanings.associate { it.dictionaryForm to it.koreanText })
            }
            val translated = translationDeferred.await()
            val (seg, jishoData, d2k) = meaningDeferred.await()
            PipelineParts(translated, seg, jishoData, d2k)
        }
        val translated = parts.translated
        val segLines = parts.segLines
        val jisho = parts.jisho
        val dict2ko = parts.dict2ko
        logger.info(
            "[songId={}] Gemini responded: {} translated lines, {} segmented lines, {} dict forms",
            entity.songId, translated.size, segLines.size, dict2ko.size,
        )

        val translationMap = translated.associateBy { it.index }
        val rawByIndex = lyricLines.associate { it.index to it.text }

        // Correction pass — translation as source of truth.
        val correctionInput = segLines.map { line ->
            mapOf(
                "index" to line.index,
                "japanese" to (rawByIndex[line.index] ?: ""),
                "korean" to (translationMap[line.index]?.koreanLyrics ?: ""),
                "words" to line.words.map { w ->
                    mapOf(
                        "surface" to w.surface,
                        "dictionaryForm" to w.dictionaryForm,
                        "koreanText" to (dict2ko[w.dictionaryForm] ?: ""),
                    )
                },
            )
        }
        val corrected = geminiClient.correctMeanings(correctionInput).associateBy { it.index }

        // dictionaryForm → reading (katakana yomigana of the dictionary form), from the seg stage.
        val readingByDictForm = segLines.flatMap { it.words }
            .associate { it.dictionaryForm to it.reading }

        // Assemble per line. Fall back to the (uncorrected) seg words if a line is missing in the
        // correction output, so no line silently loses its tokens.
        return lyricLines.map { line ->
            val words = corrected[line.index]?.words
                ?: segLines.firstOrNull { it.index == line.index }?.words?.map { w ->
                    CorrWordDto(w.surface, w.dictionaryForm, dict2ko[w.dictionaryForm] ?: "")
                }
                ?: emptyList()

            AnalyzedLine(
                index = line.index,
                koreanLyrics = translationMap[line.index]?.koreanLyrics,
                koreanPronounciation = translationMap[line.index]?.koreanPronounciation,
                tokens = buildTokens(line.text, words, jisho, readingByDictForm),
            )
        }
    }

    /**
     * Build [Token]s for one line. charStart/charEnd are recomputed by sequentially locating each
     * surface in the raw line text (the production normalizePositions pattern); POS and JLPT come
     * from jisho keyed by dictionaryForm (forms the correction pass newly created fall back to OTHER).
     */
    private fun buildTokens(
        rawText: String,
        words: List<CorrWordDto>,
        jisho: Map<String, JishoEntryDto>,
        readingByDictForm: Map<String, String>,
    ): List<Token> {
        var cursor = 0
        return words.map { w ->
            val found = rawText.indexOf(w.surface, cursor)
            val start = if (found >= 0) found else cursor
            val end = start + w.surface.length
            cursor = end

            val j = jisho[w.dictionaryForm]
            val reading = readingByDictForm[w.dictionaryForm]
            Token(
                surface = w.surface,
                baseForm = w.dictionaryForm,
                reading = reading,
                baseFormReading = reading,
                partOfSpeech = JishoPartOfSpeechMapper.map(j?.pos ?: emptyList()),
                charStart = start,
                charEnd = end,
                koreanText = w.koreanText.ifBlank { null },
                jlpt = j?.jlpt ?: emptyList(),
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

    /** Carries the results of the parallel (translation ∥ segment→meaning) stage out of coroutineScope. */
    private data class PipelineParts(
        val translated: List<TranslationResultDto>,
        val segLines: List<SegLineDto>,
        val jisho: Map<String, JishoEntryDto>,
        val dict2ko: Map<String, String>,
    )
}
