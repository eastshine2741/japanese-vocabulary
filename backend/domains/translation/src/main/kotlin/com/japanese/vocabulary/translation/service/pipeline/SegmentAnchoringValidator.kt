package com.japanese.vocabulary.translation.service.pipeline

import com.japanese.vocabulary.translation.client.gemini.dto.SegLineDto
import com.japanese.vocabulary.translation.client.gemini.dto.SegWordDto
import com.japanese.vocabulary.translation.model.PipelineToken
import com.japanese.vocabulary.translation.model.SegmentAnchoringResult
import com.japanese.vocabulary.translation.model.UncoveredRun
import org.springframework.stereotype.Component

class SegmentationValidationException(message: String) : RuntimeException(message)

@Component
class SegmentAnchoringValidator {

    /**
     * Anchors each requested line in [rawByIndex] against the segmentation response. Never throws for
     * a bad line — the caller decides which lines to retry. Lines present in the response but not
     * requested are ignored.
     */
    fun anchor(rawByIndex: Map<Int, String>, segmentedLines: List<SegLineDto>): SegmentAnchoringResult {
        val anchoredByIndex = mutableMapOf<Int, List<PipelineToken>>()
        val failuresByIndex = mutableMapOf<Int, String>()
        val incompleteByIndex = mutableMapOf<Int, UncoveredRun>()
        val seenIndices = mutableSetOf<Int>()

        segmentedLines.forEach { line ->
            val rawText = rawByIndex[line.index] ?: return@forEach
            if (!seenIndices.add(line.index)) {
                anchoredByIndex.remove(line.index)
                incompleteByIndex.remove(line.index)
                failuresByIndex[line.index] = "Duplicate line index=${line.index} in segmentation response"
                return@forEach
            }
            try {
                val anchoredLine = anchorLine(line.index, rawText, line)
                anchoredByIndex[line.index] = anchoredLine.tokens
                anchoredLine.uncovered?.let { incompleteByIndex[line.index] = it }
            } catch (e: SegmentationValidationException) {
                failuresByIndex[line.index] = e.message ?: "Segmentation validation failed at line index=${line.index}"
            }
        }

        rawByIndex.keys.forEach { index ->
            if (index !in seenIndices) {
                failuresByIndex[index] = "Missing segmented line for index=$index"
            }
        }

        return SegmentAnchoringResult(
            anchoredByIndex = anchoredByIndex,
            failuresByIndex = failuresByIndex,
            incompleteByIndex = incompleteByIndex,
        )
    }

    /**
     * Anchors the line's Japanese words to positions in [rawText], left to right.
     *
     * Words with no Japanese in them (whitespace, punctuation, latin) are **dropped, not anchored**:
     * they need no token, and searching for an invented space matches the next *real* one, dragging
     * the cursor past every word in between (`涼しい風吹く 青空の匂い` failed retries over a `風`).
     *
     * Japanese text the words left out is **reported, not thrown**: every surface sits at a real
     * position, so the tokens are usable (`晴れ舞台（イェイ）` returned as `晴れ舞台` on every retry).
     *
     * A small vowel kana or `ー` the model left off the preceding word (`あぁ` as `あ`) is not a
     * missing word; it is [absorbed][absorbTrailingKana] into the token it follows.
     *
     * A reading in parentheses right after a word (`解答(こたえ)`, `暗闇(クロ)`) is **covered by that
     * word**; it must match the token's reading, so the ad-lib `晴れ舞台（イェイ）` stays reported.
     */
    private fun anchorLine(index: Int, rawText: String, line: SegLineDto): AnchoredLine {
        val covered = BooleanArray(rawText.length)
        var cursor = 0
        var previousSurface: String? = null
        val anchored = line.words.mapNotNull { word ->
            if (!JapaneseText.containsJapanese(word.surface)) return@mapNotNull null
            // Digits glued to a counter (`80億`) stay in the raw text; only the Japanese part is a word.
            // The model's reading still spells the number until the dictionary reading replaces it.
            val surface = JapaneseText.trimDigits(word.surface)
            val start = rawText.indexOf(surface, cursor)
            if (start < 0) {
                throw SegmentationValidationException(
                    notInOrderMessage(index, word.surface, rawText, cursor, previousSurface),
                )
            }
            val usedReading = readingOf(index, word, word.usedReading, "usedReading")
            val end = start + surface.length
            for (i in start until end) covered[i] = true
            val annotationEnd = readingAnnotationEnd(rawText, end, usedReading)
            for (i in end until annotationEnd) covered[i] = true
            cursor = end
            previousSurface = word.surface
            PipelineToken(
                lineIndex = index,
                surface = surface,
                headword = JapaneseText.trimDigits(word.headword).ifEmpty { surface },
                charStart = start,
                charEnd = end,
                usedReading = usedReading,
                baseFormReading = readingOf(index, word, word.baseFormReading, "baseFormReading"),
                contextGloss = word.contextGloss,
            )
        }
        val tokens = anchored.map { absorbTrailingKana(it, rawText, covered) }.toMutableList()

        var uncovered: UncoveredRun? = null
        var from = 0
        while (true) {
            val (offset, text) = uncoveredJapaneseRun(rawText, covered, from) ?: break
            val filled = echoOf(tokens, offset, text) ?: knownParticleToken(index, offset, text)
            if (filled == null) {
                uncovered = UncoveredRun(lineIndex = index, offset = offset, text = text)
                break
            }
            tokens += filled
            for (i in offset until filled.charEnd) covered[i] = true
            from = filled.charEnd
        }
        return AnchoredLine(tokens = tokens.sortedBy { it.charStart }, uncovered = uncovered)
    }

    /**
     * A copy of the token whose surface is exactly [text], placed at [offset], or null when no token
     * on the line spells it. Lyrics echo a word (`君を探し見失う (見失う, Ah-ah-ah-ah)`) and the model
     * emits it once; the echo is the same word sung the same way, so it reuses that token.
     */
    private fun echoOf(tokens: List<PipelineToken>, offset: Int, text: String): PipelineToken? =
        tokens.firstOrNull { it.surface == text }
            ?.copy(charStart = offset, charEnd = offset + text.length)

    /** One anchored line: its tokens, and why it is incomplete if Japanese text carries no token. */
    private data class AnchoredLine(val tokens: List<PipelineToken>, val uncovered: UncoveredRun?)

    /**
     * Extends [token] over the small vowel kana and `ー` right after it that no surface claimed, and
     * marks them [covered]. Runs after every surface is anchored, so a model-emitted `ぁ` token is
     * kept. The sung reading grows by the same kana; the headword does not.
     *
     * An extra `々` after a surface already ending in `々` (`悶々々`) is absorbed too, leaving the
     * reading alone. A `々` after a plain kanji (`人々`) is a different word and stays.
     */
    private fun absorbTrailingKana(token: PipelineToken, rawText: String, covered: BooleanArray): PipelineToken {
        var end = token.charEnd
        if (token.surface.endsWith(ITERATION_MARK)) {
            while (end < rawText.length && !covered[end] && rawText[end] == ITERATION_MARK) end++
        }
        val markEnd = end
        while (end < rawText.length && !covered[end] && rawText[end] in TRAILING_KANA) end++
        if (end == token.charEnd) return token
        for (i in token.charEnd until end) covered[i] = true
        val tail = rawText.substring(markEnd, end)
        return token.copy(
            surface = token.surface + rawText.substring(token.charEnd, end),
            charEnd = end,
            usedReading = token.usedReading + JapaneseText.toKatakana(tail),
        )
    }

    /**
     * Token for a one-character particle the model left out, or null when [text] is not one.
     * [RuleMeaningProvider] already knows its meaning, so no retry is spent on it. Longer or unknown
     * runs are still reported.
     */
    private fun knownParticleToken(index: Int, offset: Int, text: String): PipelineToken? {
        val particle = text.takeIf { it in RuleMeaningProvider.KnownParticles.singleCharacter } ?: return null
        val reading = JapaneseText.toKatakana(particle)
        return PipelineToken(
            lineIndex = index,
            surface = particle,
            headword = particle,
            charStart = offset,
            charEnd = offset + 1,
            usedReading = reading,
            baseFormReading = reading,
        )
    }

    private val ITERATION_MARK = '々'

    /**
     * Kana that only stretch or cut off the sound in front of them and never open a word of their own.
     * `っ` belongs here for the emphatic stop that closes `夢中っ`.
     */
    private val TRAILING_KANA = setOf('ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ァ', 'ィ', 'ゥ', 'ェ', 'ォ', 'ー', 'っ', 'ッ')

    /**
     * End (exclusive) of a `(kana)` / `（kana）` span starting exactly at [from] that spells
     * [usedReading], or [from] itself when there is none. Kana that reads differently, or contains
     * kanji, is a word of its own. The cursor is not moved past the span.
     *
     * The kana may spell only the start of [usedReading] when okurigana follows the span
     * (`愁(かな)しみ` read `カナシミ`); that okurigana is covered with the span.
     */
    private fun readingAnnotationEnd(rawText: String, from: Int, usedReading: String): Int {
        if (from >= rawText.length) return from
        val close = when (rawText[from]) {
            '(' -> ')'
            '（' -> '）'
            else -> return from
        }
        val closeAt = rawText.indexOf(close, from + 1)
        if (closeAt < 0) return from
        val inside = rawText.substring(from + 1, closeAt)
        if (!JapaneseText.isKanaOnly(inside)) return from
        val annotated = JapaneseText.toKatakana(inside)
        if (!usedReading.startsWith(annotated)) return from
        val rest = usedReading.substring(annotated.length)
        val afterSpan = closeAt + 1
        val okurigana = rawText.substring(afterSpan, (afterSpan + rest.length).coerceAtMost(rawText.length))
        val spellsRest = rest.isNotEmpty() && JapaneseText.isKanaOnly(okurigana) &&
            JapaneseText.toKatakana(okurigana) == rest
        return if (spellsRest) afterSpan + rest.length else afterSpan
    }

    /**
     * Says where the search stood when it gave up: naming only the missing surface reads as "not in
     * the line" even when it is, and the retry cannot converge. Quotes the text ahead of the cursor
     * and the surface that put it there.
     */
    private fun notInOrderMessage(
        index: Int,
        surface: String,
        rawText: String,
        cursor: Int,
        previousSurface: String?,
    ): String {
        val remaining = rawText.substring(cursor.coerceAtMost(rawText.length))
        val after = previousSurface?.let { " after surface '$it'" } ?: " at the start of the line"
        return "Surface '$surface' is not present in order at line index=$index: " +
            "the text still unmatched$after is '$remaining'"
    }

    /**
     * The first run of consecutive Japanese characters at or after [from] no surface claimed, as
     * `(offset, text)`.
     *
     * The run rather than its first character, so the model sees a segmentation (`風吹く`) to fix.
     */
    private fun uncoveredJapaneseRun(rawText: String, covered: BooleanArray, from: Int): Pair<Int, String>? {
        val start = (from until rawText.length).firstOrNull { i ->
            !covered[i] && JapaneseText.containsJapanese(rawText[i].toString())
        } ?: return null
        var end = start
        while (end < rawText.length && !covered[end] && JapaneseText.containsJapanese(rawText[end].toString())) {
            end++
        }
        return start to rawText.substring(start, end)
    }

    /**
     * Normalizes one reading field, or fails the line. Only Japanese surfaces reach here ([anchorLine]
     * dropped the rest).
     *
     * The reading must be kana (otherwise only this line is retried). Hiragana is not a failure:
     * [JapaneseText.toKatakana] absorbs it, cheaper than a retry.
     */
    private fun readingOf(index: Int, word: SegWordDto, reading: String, field: String): String {
        if (!JapaneseText.isKanaOnly(reading)) {
            throw SegmentationValidationException(
                "$field '$reading' for surface '${word.surface}' is not kana-only at line index=$index",
            )
        }
        return JapaneseText.toKatakana(reading)
    }
}
