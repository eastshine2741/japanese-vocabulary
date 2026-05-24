package com.japanese.vocabulary.user.dto

data class UserSettingsDTO(
    val requestRetention: Double,
    val showIntervals: Boolean = true,
    val readingDisplay: String = "KOREAN",
    val showKoreanPronunciation: Boolean = true,
    val showFurigana: Boolean = true,
    val dailyGoal: Int = 10
)
