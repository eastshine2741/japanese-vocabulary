package com.japanese.vocabulary.translation.service.pipeline

import com.japanese.vocabulary.translation.client.gemini.dto.SegLineDto
import com.japanese.vocabulary.translation.client.gemini.dto.SegWordDto
import com.japanese.vocabulary.translation.model.PipelineToken
import com.japanese.vocabulary.translation.model.SegmentAnchoringResult
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
        val seenIndices = mutableSetOf<Int>()

        segmentedLines.forEach { line ->
            val rawText = rawByIndex[line.index] ?: return@forEach
            if (!seenIndices.add(line.index)) {
                anchoredByIndex.remove(line.index)
                failuresByIndex[line.index] = "Duplicate line index=${line.index} in segmentation response"
                return@forEach
            }
            try {
                anchoredByIndex[line.index] = anchorLine(line.index, rawText, line)
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
        )
    }

    private fun anchorLine(index: Int, rawText: String, line: SegLineDto): List<PipelineToken> {
        val covered = BooleanArray(rawText.length)
        var cursor = 0
        val tokens = line.words.map { word ->
            if (word.surface.isEmpty()) {
                throw SegmentationValidationException("Empty surface at line index=$index")
            }
            val start = rawText.indexOf(word.surface, cursor)
            if (start < 0) {
                throw SegmentationValidationException(
                    "Surface '${word.surface}' is not present in order at line index=$index",
                )
            }
            val end = start + word.surface.length
            for (i in start until end) covered[i] = true
            cursor = end
            PipelineToken(
                lineIndex = index,
                surface = word.surface,
                headword = word.headword,
                charStart = start,
                charEnd = end,
                usedReading = readingOf(index, word, word.usedReading, "usedReading"),
                baseFormReading = readingOf(index, word, word.baseFormReading, "baseFormReading"),
                contextGloss = word.contextGloss,
            )
        }

        rawText.forEachIndexed { i, ch ->
            if (!covered[i] && JapaneseText.containsJapanese(ch.toString())) {
                throw SegmentationValidationException(
                    "Character '$ch' at offset=$i is not covered by segmentation at line index=$index",
                )
            }
        }
        return tokens
    }

    /**
     * Normalizes one reading field, or fails the line.
     *
     * A non-Japanese surface (whitespace, punctuation, latin, digits) has no reading to speak of, so
     * its reading is *forced* to the surface rather than validated — whatever the model invented there
     * is discarded. For a Japanese surface the reading must be kana; anything else (kanji left in,
     * empty string) means the model did not do the job and only this line is retried. Hiragana is not
     * a failure: the prompt asks for katakana but [JapaneseText.toKatakana] absorbs the other script,
     * which is a cheaper correction than a round trip.
     */
    private fun readingOf(index: Int, word: SegWordDto, reading: String, field: String): String {
        if (!JapaneseText.containsJapanese(word.surface)) return word.surface
        if (!JapaneseText.isKanaOnly(reading)) {
            throw SegmentationValidationException(
                "$field '$reading' for surface '${word.surface}' is not kana-only at line index=$index",
            )
        }
        return JapaneseText.toKatakana(reading)
    }
}
