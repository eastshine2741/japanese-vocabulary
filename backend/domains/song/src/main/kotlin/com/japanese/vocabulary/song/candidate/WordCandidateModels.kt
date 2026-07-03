package com.japanese.vocabulary.song.candidate

import com.fasterxml.jackson.annotation.JsonInclude

@JsonInclude(JsonInclude.Include.NON_NULL)
data class LyricWordCandidates(
    val candidates: List<WordCandidate>,
    val lineCandidates: Map<String, List<Int>>,
)

@JsonInclude(JsonInclude.Include.NON_NULL)
data class WordCandidate(
    val japanese: String,
    val surface: String,
    val baseForm: String?,
    val reading: String?,
    val baseFormReading: String?,
    val koreanText: String?,
    val partOfSpeech: String,
    val partOfSpeechLabel: String,
    val jlpt: String?,
    val importanceScore: Double,
    val appearanceOrder: Int,
    val frequency: Int,
    val lineIndexes: List<Int>,
    val scoreComponents: WordScoreComponents,
)

data class WordScoreComponents(
    val lineCoverage: Double,
    val logFrequency: Double,
    val dispersion: Double,
    val titleBoost: Double,
    val posWeight: Double,
)
