package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.LyricWordCandidates
import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.song.model.WordCandidate
import com.japanese.vocabulary.song.model.WordScoreComponents
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
        }

        // candidates 배열 순서는 곡 전체 등장순이다 — occurrences 가 LinkedHashMap 이라 첫 등장 시점에 자리가 잡힌다.
        // 중요도 순위는 배열 순서가 아니라 importanceScore 로 따로 매긴다. 배열 순서를 중요도로 잡으면
        // 이 인덱스를 참조하는 lineCandidates 까지 중요도순으로 끌려간다.
        val candidateIndexByKey = occurrences.keys.withIndex().associate { (index, key) -> key to index }
        // 가사 줄별 단어는 그 줄 안에서 나온 순서다. order 는 줄 단위로 증가하므로 줄 안에서는 토큰 위치와 같다.
        val lineCandidates = occurrences.entries
            .flatMap { (key, group) ->
                group.map { LineSlot(it.lineIndex, it.order, candidateIndexByKey.getValue(key)) }
            }
            .sortedWith(compareBy({ it.lineIndex }, { it.order }))
            .groupBy({ it.lineIndex.toString() }, { it.candidateIndex })
            .mapValues { (_, indexes) -> indexes.distinct() }

        return LyricWordCandidates(
            candidates = candidates,
            lineCandidates = lineCandidates,
        )
    }

    private data class LineSlot(
        val lineIndex: Int,
        val order: Int,
        val candidateIndex: Int,
    )

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
