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
     * Words with no Japanese in them — whitespace, punctuation, latin runs — are **dropped instead of
     * anchored**. They carry no reading and no meaning, and both the assembled pronunciation and the
     * app read them straight back out of the raw text by position, so nothing needs a token for them.
     * Searching for them was actively harmful: a space the model invented matches whichever *real*
     * space comes next, which drags the cursor past every word in between and then blames the first of
     * those for not being present. `涼しい風吹く 青空の匂い` failed four identical retries over a `風`
     * sitting right there at offset 3, because a bogus space after `涼しい` had already consumed the
     * one at offset 6.
     *
     * Japanese text the words left out is **reported, not thrown**. Every surface was found at a real
     * position, so the tokens are usable as they are; what is missing is a word, not a position. The
     * uncovered case is a model that skipped part of the line — `晴れ舞台（イェイ）` came back as
     * `晴れ舞台` four attempts running, because a parenthesized ad-lib does not read as a lyric word —
     * and losing one ad-lib is not worth losing the song.
     *
     * One kind of leftover is not a missing word: a small vowel kana or `ー` the model left off the
     * word in front of it. `あぁ` came back as `あ` on every attempt, and a retry asked to segment `ぁ`
     * cannot, because it is not a word — it stretches the `あ`. Those are [absorbed][absorbTrailingKana]
     * into the token they follow instead of being reported.
     *
     * A word's reading written in parentheses right after it is **covered by that word**. Lyrics
     * annotate the sung reading that way — `解答(こたえ)`, `暗闇(クロ)`, `×点(ばってん)` — and the kana
     * is how the word before it is pronounced, not a word of its own. The model rightly leaves it out
     * of the segmentation and puts it in `usedReading` instead, and there is no dictionary meaning to
     * look up for it, so reporting it as uncovered only produced a defect no retry could fix. The
     * kana has to match the reading the token carries: `晴れ舞台（イェイ）` is still an ad-lib the
     * model skipped, and stays reported.
     */
    private fun anchorLine(index: Int, rawText: String, line: SegLineDto): AnchoredLine {
        val covered = BooleanArray(rawText.length)
        var cursor = 0
        var previousSurface: String? = null
        val anchored = line.words.mapNotNull { word ->
            if (!JapaneseText.containsJapanese(word.surface)) return@mapNotNull null
            val start = rawText.indexOf(word.surface, cursor)
            if (start < 0) {
                throw SegmentationValidationException(
                    notInOrderMessage(index, word.surface, rawText, cursor, previousSurface),
                )
            }
            val usedReading = readingOf(index, word, word.usedReading, "usedReading")
            val end = start + word.surface.length
            for (i in start until end) covered[i] = true
            val annotationEnd = readingAnnotationEnd(rawText, end, usedReading)
            for (i in end until annotationEnd) covered[i] = true
            cursor = end
            previousSurface = word.surface
            PipelineToken(
                lineIndex = index,
                surface = word.surface,
                headword = word.headword,
                charStart = start,
                charEnd = end,
                usedReading = usedReading,
                baseFormReading = readingOf(index, word, word.baseFormReading, "baseFormReading"),
                contextGloss = word.contextGloss,
            )
        }
        val tokens = anchored.map { absorbTrailingKana(it, rawText, covered) }

        val uncovered = uncoveredJapaneseRun(rawText, covered)?.let { (offset, text) ->
            UncoveredRun(lineIndex = index, offset = offset, text = text)
        }
        return AnchoredLine(tokens = tokens, uncovered = uncovered)
    }

    /** One anchored line: its tokens, and why it is incomplete if Japanese text carries no token. */
    private data class AnchoredLine(val tokens: List<PipelineToken>, val uncovered: UncoveredRun?)

    /**
     * Extends [token] over the small vowel kana and `ー` right after it that no surface claimed, and
     * marks them [covered]. Runs after every surface is anchored, so a model that did emit `ぁ` as its
     * own token keeps it. The sung reading grows by the same kana; the headword does not.
     */
    private fun absorbTrailingKana(token: PipelineToken, rawText: String, covered: BooleanArray): PipelineToken {
        var end = token.charEnd
        while (end < rawText.length && !covered[end] && rawText[end] in TRAILING_KANA) end++
        if (end == token.charEnd) return token
        for (i in token.charEnd until end) covered[i] = true
        val tail = rawText.substring(token.charEnd, end)
        return token.copy(
            surface = token.surface + tail,
            charEnd = end,
            usedReading = token.usedReading + JapaneseText.toKatakana(tail),
        )
    }

    /** Kana that only stretch the sound in front of them and never open a word of their own. */
    private val TRAILING_KANA = setOf('ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ァ', 'ィ', 'ゥ', 'ェ', 'ォ', 'ー')

    /**
     * End (exclusive) of a `(kana)` / `（kana）` span starting exactly at [from] that spells
     * [usedReading], or [from] itself when there is none. Kana that reads differently from the word
     * is a word of its own and stays for the model to segment; so does anything with kanji in it. The
     * cursor is not moved past the span, so a model that does emit the kana as its own token still
     * anchors it normally.
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
        val isAnnotation = JapaneseText.isKanaOnly(inside) && JapaneseText.toKatakana(inside) == usedReading
        return if (isAnnotation) closeAt + 1 else from
    }

    /**
     * Says where the search actually stood when it gave up. Naming only the missing surface reads as
     * "this word is not in the line" even when it plainly is, and a retry told to fix a word that is
     * already right cannot converge. Quoting the text still ahead of the cursor — and the surface that
     * put it there — is the part the model can act on.
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
     * The first run of consecutive Japanese characters no surface claimed, as `(offset, text)`.
     *
     * The run rather than its first character: `風吹く` left behind by a mis-anchored line is a
     * segmentation the model can look at, where `Character '風'` invites it to fix one character.
     */
    private fun uncoveredJapaneseRun(rawText: String, covered: BooleanArray): Pair<Int, String>? {
        val start = rawText.indices.firstOrNull { i ->
            !covered[i] && JapaneseText.containsJapanese(rawText[i].toString())
        } ?: return null
        var end = start
        while (end < rawText.length && !covered[end] && JapaneseText.containsJapanese(rawText[end].toString())) {
            end++
        }
        return start to rawText.substring(start, end)
    }

    /**
     * Normalizes one reading field, or fails the line. Only Japanese surfaces reach here — the rest
     * were dropped by [anchorLine], so whatever the model invented as their reading is discarded with
     * them.
     *
     * The reading must be kana; anything else (kanji left in, empty string) means the model did not do
     * the job and only this line is retried. Hiragana is not a failure: the prompt asks for katakana
     * but [JapaneseText.toKatakana] absorbs the other script, which is a cheaper correction than a
     * round trip.
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
