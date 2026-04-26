package com.japanese.vocabulary.studystats.dto

data class WeekDot(
    val date: String, // ISO yyyy-MM-dd in KST study-date space
    val status: String, // "studied" | "none" | "freeze" | "today"
)

data class HomeStatsResponse(
    val currentStreak: Int,
    val freezeCount: Int,
    val freezeMax: Int,
    val weekDots: List<WeekDot>,
)

data class ProfileStatsResponse(
    val currentStreak: Int,
    val longestStreak: Int,
    val totalStudyDays: Int,
    val freezeCount: Int,
    val freezeMax: Int,
    val dailyGoal: Int,
)

data class HeatmapDay(
    val date: String,
    val reviewCount: Int,
    val freezeUsed: Boolean,
)

data class HeatmapResponse(
    val days: List<HeatmapDay>,
)
