package com.japanese.vocabulary.studystats.dto

data class HomeStatsResponse(
    val currentStreak: Int,
    val freezeCount: Int,
    val freezeMax: Int,
    val weekDots: List<WeekDotDto>,
)
