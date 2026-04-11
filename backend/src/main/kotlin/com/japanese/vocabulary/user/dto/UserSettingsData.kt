package com.japanese.vocabulary.user.dto

data class UserSettingsData(
    val requestRetention: Double = 0.9,
    val showIntervals: Boolean = true,
    val readingDisplay: String = "KATAKANA"
)
