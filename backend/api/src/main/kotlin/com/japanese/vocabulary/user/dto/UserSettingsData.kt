package com.japanese.vocabulary.user.dto

data class UserSettingsData(
    val requestRetention: Double = 0.9,
    val showIntervals: Boolean = true,
    val readingDisplay: String = "KOREAN",
    val showKoreanPronunciation: Boolean = true,
    val showFurigana: Boolean = true,
    val dailyGoal: Int = 10
)
