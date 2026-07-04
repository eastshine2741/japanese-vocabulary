package com.japanese.vocabulary.translation.service.pipeline

import com.japanese.vocabulary.translation.client.gemini.dto.SegLineDto
import com.japanese.vocabulary.translation.model.PipelineToken
import org.springframework.stereotype.Component

class SegmentationValidationException(message: String) : RuntimeException(message)

@Component
class SegmentAnchoringValidator {

    fun validate(rawByIndex: Map<Int, String>, segmentedLines: List<SegLineDto>): Map<Int, List<PipelineToken>> {
        validateLineIndices(rawByIndex.keys, segmentedLines)
        val segmentedByIndex = segmentedLines.associateBy { it.index }
        return rawByIndex.mapValues { (index, rawText) ->
            val line = segmentedByIndex[index]
                ?: throw SegmentationValidationException("Missing segmented line for index=$index")
            anchorLine(index, rawText, line)
        }
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
                dictionaryForm = word.dictionaryForm,
                charStart = start,
                charEnd = end,
            )
        }

        rawText.forEachIndexed { i, ch ->
            if (!covered[i]) {
                throw SegmentationValidationException(
                    "Character '$ch' at offset=$i is not covered by segmentation at line index=$index",
                )
            }
        }
        return tokens
    }

    private fun validateLineIndices(expectedIndices: Set<Int>, segmentedLines: List<SegLineDto>) {
        val actualIndices = segmentedLines.map { it.index }
        val duplicated = actualIndices.groupingBy { it }.eachCount().filterValues { it > 1 }.keys
        if (duplicated.isNotEmpty()) {
            throw SegmentationValidationException("Segmentation returned duplicate line indices: $duplicated")
        }
        val actualSet = actualIndices.toSet()
        if (actualSet != expectedIndices) {
            throw SegmentationValidationException(
                "Segmentation line indices mismatch: expected=$expectedIndices actual=$actualSet",
            )
        }
    }

}
