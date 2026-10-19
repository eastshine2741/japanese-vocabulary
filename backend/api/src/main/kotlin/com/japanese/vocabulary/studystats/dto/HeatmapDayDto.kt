package com.japanese.vocabulary.studystats.dto

data class HeatmapDayDto(
    val date: String,
    val reviewCount: Int,
    val freezeUsed: Boolean,
)

fun DailyStudySummaryDto.toHeatmapDay() = HeatmapDayDto(
    date = dateKst.toString(),
    reviewCount = reviewCount,
    freezeUsed = freezeUsed,
)
