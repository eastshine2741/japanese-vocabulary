package com.japanese.vocabulary.studystats.dto

data class HeatmapDayDto(
    val date: String,
    val reviewCount: Int,
    val freezeUsed: Boolean,
)
