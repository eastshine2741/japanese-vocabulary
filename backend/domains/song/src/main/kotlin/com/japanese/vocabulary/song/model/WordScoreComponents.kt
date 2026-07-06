package com.japanese.vocabulary.song.model

data class WordScoreComponents(
    val lineCoverage: Double,
    val logFrequency: Double,
    val dispersion: Double,
    val titleBoost: Double,
    val posWeight: Double,
)
