package com.japanese.vocabulary.translation.service

import org.springframework.stereotype.Service
import com.japanese.vocabulary.translation.client.gemini.GeminiClient
import com.japanese.vocabulary.translation.client.gemini.dto.SegLineDto
import com.japanese.vocabulary.translation.client.gemini.dto.SelectWordDto
import com.japanese.vocabulary.translation.client.gemini.dto.TranslationResultDto
import com.japanese.vocabulary.translation.client.jisho.JishoPartOfSpeechMapper
import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoOptionDto
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.song.model.Token
import com.japanese.vocabulary.song.repository.LyricRepository
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import org.slf4j.LoggerFactory
import org.springframework.transaction.annotation.Transactional

/**
 * Domain-level lyric translation operations. Exposes pure compute and analyzed-content persistence
 * over a single [LyricEntity]. Work polling, stage transitions, and terminal failure handling live
 * in the batch module's song-analysis work scheduler/processor.
 *
 * The word-meaning pipeline is the redesigned segment → jisho → sense-select → translate harness
 * (Kuromoji dropped, correction pass removed). See [runPipeline].
 */
@Service
class KoreanLyricTranslationService(
    private val lyricRepository: LyricRepository,
    private val geminiClient: GeminiClient,
    private val jishoService: JishoService,
) {
    private val logger = LoggerFactory.getLogger("KoreanLyricTranslation")

    /**
     * Pure compute: the redesigned word-meaning pipeline. No DB writes.
     * Throws on failure so the work processor can mark the owning work terminal FAILED.
     *
     * Stages (all word-meaning calls use the lightweight model). Diagram:
     *   `(translation ∥ [segment → jisho]) → sense-select → translate-sense → assemble`
     *  1. **segment+lemmatize** (LLM): raw line → [{surface, dictionaryForm}] (meaning-aware, no reading).
     *  2. **jisho** (code): unique dictionaryForms → options (every sense of every exact-match entry,
     *     fuzzy-fallback to the top entry). Code assigns a global int senseId to each option.
     *     Runs in parallel with **translation** (pro): line → koreanLyrics + koreanPronounciation.
     *  3. **sense-select** (LLM): per line, using the Korean translation as a cue, pick the senseId that
     *     fits each word (or -1). The LLM does not write meanings → blocks over-correction.
     *  4. **translate-sense** (LLM): unique chosen English senses → Korean (POS-consistent, particles as
     *     Korean particles).
     *  5. **assemble**: senseId≥0 → reading/POS/JLPT from the chosen option, koreanText from translate;
     *     senseId=-1 → all null (no fallback). charStart/charEnd recomputed via sequential indexOf.
     */
    suspend fun runPipeline(entity: LyricEntity): List<AnalyzedLine> {
        logger.info(
            "[songId={}] Starting translation",
            entity.songId,
        )

        val lyricLines = entity.rawContent
        logger.info("[songId={}] Parsed {} lyric lines", entity.songId, lyricLines.size)

        val lineInput = lyricLines.map { mapOf("index" to it.index, "text" to it.text) }

        // Translation (pro) runs in parallel with the [segment → jisho] chain.
        logger.info("[songId={}] Calling Gemini APIs (translation ∥ segment→jisho)...", entity.songId)
        val parts = coroutineScope {
            val translationDeferred = async { geminiClient.translateLyrics(lineInput) }
            val segJishoDeferred = async {
                val seg = geminiClient.segmentAndLemmatize(lineInput)
                val dictForms = seg.flatMap { it.words }.map { it.dictionaryForm }.distinct()
                val jishoData = jishoService.lookupAll(dictForms)
                seg to jishoData
            }
            val translated = translationDeferred.await()
            val (seg, jishoData) = segJishoDeferred.await()
            PipelineParts(translated, seg, jishoData)
        }
        val translated = parts.translated
        val segLines = parts.segLines
        val jisho = parts.jisho
        logger.info(
            "[songId={}] Gemini responded: {} translated lines, {} segmented lines, {} dict forms",
            entity.songId, translated.size, segLines.size, jisho.size,
        )

        val translationMap = translated.associateBy { it.index }
        val rawByIndex = lyricLines.associate { it.index to it.text }

        // Assign a global senseId to every jisho option; build senseId→option and dictForm→senses(for prompt).
        val optionsById = HashMap<Int, JishoOptionDto>()
        val sensesByDictForm = HashMap<String, List<Map<String, Any?>>>()
        var nextSenseId = 0
        val dictForms = segLines.flatMap { it.words }.map { it.dictionaryForm }.distinct().sorted()
        for (df in dictForms) {
            val options = jisho[df]?.options ?: emptyList()
            sensesByDictForm[df] = options.map { o ->
                val sid = nextSenseId++
                optionsById[sid] = o
                mapOf("senseId" to sid, "english" to o.english, "pos" to o.pos.joinToString(" / "))
            }
        }

        // Sense-select (LLM) — Korean translation as the context cue.
        val selectInput = segLines.map { line ->
            mapOf(
                "index" to line.index,
                "japanese" to (rawByIndex[line.index] ?: ""),
                "korean" to (translationMap[line.index]?.koreanLyrics ?: ""),
                "segments" to line.words.map { w ->
                    mapOf(
                        "surface" to w.surface,
                        "dictionaryForm" to w.dictionaryForm,
                        "senses" to (sensesByDictForm[w.dictionaryForm] ?: emptyList()),
                    )
                },
            )
        }
        val selectByIndex = geminiClient.selectSenses(selectInput).associateBy { it.index }

        // Translate-sense (LLM) — only the chosen English senses, once each.
        val chosenIds = selectByIndex.values
            .flatMap { it.words }
            .map { it.senseId }
            .filter { it >= 0 && optionsById.containsKey(it) }
            .distinct()
            .sorted()
        val translateInput = chosenIds.map { sid ->
            val o = optionsById.getValue(sid)
            mapOf(
                "senseId" to sid,
                "pos" to JishoPartOfSpeechMapper.map(o.pos).name,
                "english" to o.english,
            )
        }
        val koreanBySenseId = geminiClient.translateSenses(translateInput)
            .associate { it.senseId to it.koreanText }

        // Assemble per line. Fall back to seg words (senseId=-1) if a line is missing in select output.
        val segByIndex = segLines.associateBy { it.index }
        return lyricLines.map { line ->
            val words = selectByIndex[line.index]?.words
                ?: segByIndex[line.index]?.words?.map { SelectWordDto(it.surface, it.dictionaryForm, -1) }
                ?: emptyList()

            AnalyzedLine(
                index = line.index,
                koreanLyrics = translationMap[line.index]?.koreanLyrics,
                koreanPronounciation = translationMap[line.index]?.koreanPronounciation,
                tokens = buildTokens(line.text, words, optionsById, koreanBySenseId),
            )
        }
    }

    /**
     * Build [Token]s for one line. charStart/charEnd are recomputed by sequentially locating each
     * surface in the raw line text (the playground `positions` pattern). reading/POS/JLPT/koreanText
     * all come from the jisho option chosen by the sense-select LLM; senseId=-1 → all null (no fallback).
     */
    private fun buildTokens(
        rawText: String,
        words: List<SelectWordDto>,
        optionsById: Map<Int, JishoOptionDto>,
        koreanBySenseId: Map<Int, String>,
    ): List<Token> {
        var cursor = 0
        return words.map { w ->
            var i = rawText.indexOf(w.surface, cursor)
            if (i < 0) i = rawText.indexOf(w.surface)
            val start: Int
            val end: Int
            if (i < 0) {
                start = cursor; end = cursor
            } else {
                start = i; end = i + w.surface.length; cursor = end
            }

            // Non-Japanese tokens (punctuation, Latin, digits, 「」、…) are not vocabulary: mark SYMBOL
            // with no meaning so the frontend can exclude them. Mirrors the dropped Kuromoji-era filter.
            if (!JAPANESE_REGEX.containsMatchIn(w.surface)) {
                return@map Token(
                    surface = w.surface,
                    baseForm = w.dictionaryForm,
                    reading = null,
                    baseFormReading = null,
                    partOfSpeech = PartOfSpeech.SYMBOL,
                    charStart = start,
                    charEnd = end,
                    koreanText = null,
                    jlpt = null,
                )
            }

            val option = if (w.senseId >= 0) optionsById[w.senseId] else null
            Token(
                surface = w.surface,
                baseForm = w.dictionaryForm,
                reading = option?.reading,
                baseFormReading = option?.reading,
                partOfSpeech = if (option != null) JishoPartOfSpeechMapper.map(option.pos) else PartOfSpeech.OTHER,
                charStart = start,
                charEnd = end,
                koreanText = if (option != null) koreanBySenseId[w.senseId] else null,
                jlpt = if (option != null) easiestJlpt(option.jlpt) else null,
            )
        }
    }

    /**
     * jisho jlpt is an entry-level array (e.g. ["jlpt-n1","jlpt-n5"]), not sense-scoped. Reduce to the
     * single EASIEST level (largest N = N5) — when the learner first meets the word. Mirrors `easiest_jlpt`.
     */
    private fun easiestJlpt(jlpt: List<String>): String? {
        val levels = jlpt.mapNotNull { it.substringAfterLast("-n", "").toIntOrNull() }
        return levels.maxOrNull()?.let { "N$it" }
    }

    @Transactional
    fun saveAnalyzedContent(entity: LyricEntity, lines: List<AnalyzedLine>) {
        entity.analyzedContent = lines
        lyricRepository.save(entity)
        logger.info("[songId={}] Analyzed lyric content saved", entity.songId)
    }

    /** Carries the results of the parallel (translation ∥ segment→jisho) stage out of coroutineScope. */
    private data class PipelineParts(
        val translated: List<TranslationResultDto>,
        val segLines: List<SegLineDto>,
        val jisho: Map<String, JishoEntryDto>,
    )

    private companion object {
        /** Hiragana, katakana, kanji (+ ext-A), halfwidth katakana. A surface with none of these is
         *  punctuation / Latin / digits → not vocabulary. */
        val JAPANESE_REGEX =
            Regex("[぀-ゟ゠-ヿ一-鿿㐀-䶿ｦ-ﾟ]")
    }
}
