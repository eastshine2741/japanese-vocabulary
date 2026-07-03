package com.japanese.vocabulary.song.candidate

import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.PartOfSpeech
import org.springframework.stereotype.Component
import kotlin.math.ln

@Component
class WordCandidateGenerator {
    fun generate(title: String, analyzedLines: List<AnalyzedLine>): LyricWordCandidates {
        val totalLines = analyzedLines.map { it.index }.distinct().size.coerceAtLeast(1)
        val occurrences = linkedMapOf<String, MutableList<Occurrence>>()
        var order = 0
        for (line in analyzedLines.sortedBy { it.index }) {
            for (token in line.tokens) {
                if (token.partOfSpeech in EXCLUDED_POS) continue
                val japanese = token.baseForm.takeUnless { it.isBlank() } ?: token.surface
                if (japanese.isBlank()) continue
                val key = listOf(japanese, token.partOfSpeech.name, token.koreanText.orEmpty()).joinToString("\u0001")
                occurrences.getOrPut(key) { mutableListOf() }.add(
                    Occurrence(
                        surface = token.surface,
                        baseForm = token.baseForm.takeUnless { it.isBlank() },
                        reading = token.reading,
                        baseFormReading = token.baseFormReading,
                        koreanText = token.koreanText,
                        partOfSpeech = token.partOfSpeech,
                        jlpt = token.jlpt,
                        lineIndex = line.index,
                        order = order++,
                    ),
                )
            }
        }

        val candidates = occurrences.values.map { group ->
            val first = group.minBy { it.order }
            val lineIndexes = group.map { it.lineIndex }.distinct().sorted()
            val frequency = group.size
            val lineCoverage = lineIndexes.size.toDouble() / totalLines
            val logFrequency = ln(frequency.toDouble() + 1.0)
            val dispersion = if (lineIndexes.size <= 1) 0.0 else (lineIndexes.last() - lineIndexes.first()).toDouble() / totalLines
            val titleBoost = if (title.contains(first.baseForm ?: first.surface) || title.contains(first.surface)) 1.0 else 0.0
            val posWeight = POS_WEIGHTS[first.partOfSpeech] ?: 0.6
            val importance = (lineCoverage * 35.0) + (logFrequency * 20.0) + (dispersion * 10.0) + (titleBoost * 12.0) + (posWeight * 10.0)
            WordCandidate(
                japanese = first.baseForm ?: first.surface,
                surface = first.surface,
                baseForm = first.baseForm,
                reading = first.reading,
                baseFormReading = first.baseFormReading,
                koreanText = first.koreanText,
                partOfSpeech = first.partOfSpeech.name,
                partOfSpeechLabel = first.partOfSpeech.koreanName,
                jlpt = first.jlpt,
                importanceScore = importance,
                appearanceOrder = first.order,
                frequency = frequency,
                lineIndexes = lineIndexes,
                scoreComponents = WordScoreComponents(lineCoverage, logFrequency, dispersion, titleBoost, posWeight),
            )
        }.sortedWith(compareByDescending<WordCandidate> { it.importanceScore }.thenBy { it.appearanceOrder }.thenBy { it.japanese })

        val originalIndexByCandidate = candidates.mapIndexed { index, candidate -> candidate to index }.toMap()
        val lineCandidates = candidates.flatMap { candidate -> candidate.lineIndexes.map { it to originalIndexByCandidate.getValue(candidate) } }
            .groupBy({ it.first.toString() }, { it.second })
            .mapValues { (_, indexes) -> indexes.distinct() }

        return LyricWordCandidates(
            candidates = candidates,
            lineCandidates = lineCandidates,
        )
    }

    private data class Occurrence(
        val surface: String,
        val baseForm: String?,
        val reading: String?,
        val baseFormReading: String?,
        val koreanText: String?,
        val partOfSpeech: PartOfSpeech,
        val jlpt: String?,
        val lineIndex: Int,
        val order: Int,
    )

    companion object {
        private val EXCLUDED_POS = setOf(
            PartOfSpeech.PARTICLE,
            PartOfSpeech.AUXILIARY_VERB,
            PartOfSpeech.SYMBOL,
            PartOfSpeech.SUPPLEMENTARY_SYMBOL,
            PartOfSpeech.WHITESPACE,
            PartOfSpeech.FILLER,
        )
        private val POS_WEIGHTS = mapOf(
            PartOfSpeech.NOUN to 1.2,
            PartOfSpeech.VERB to 1.2,
            PartOfSpeech.ADJECTIVE to 1.1,
            PartOfSpeech.NA_ADJECTIVE to 1.1,
            PartOfSpeech.ADVERB to 1.0,
            PartOfSpeech.PRONOUN to 0.5,
        )
    }
}
