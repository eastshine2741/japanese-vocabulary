package com.japanese.vocabulary.studystats.dto

data class ProfileStatsResponse(
    val currentStreak: Int,
    val longestStreak: Int,
    val totalStudyDays: Int,
    val freezeCount: Int,
    val freezeMax: Int,
    val dailyGoal: Int,
)
