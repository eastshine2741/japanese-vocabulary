package com.japanese.vocabulary.song.model

data class WordScoreComponents(
    val lineCoverage: Double,
    val logFrequency: Double,
    val dispersion: Double,
    val titleBoost: Double,
    val posWeight: Double,
    // 기존 저장 JSON 에는 없는 필드라 기본값이 필요하다.
    val commonPenalty: Double = 1.0,
)
