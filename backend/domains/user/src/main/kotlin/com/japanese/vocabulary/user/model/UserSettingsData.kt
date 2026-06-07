package com.japanese.vocabulary.user.model

import com.fasterxml.jackson.annotation.JsonIgnoreProperties

@JsonIgnoreProperties(ignoreUnknown = true)
data class UserSettingsData(
    val showIntervals: Boolean = true,
    val readingDisplay: String = "KOREAN",
    val showKoreanPronunciation: Boolean = true,
    val showFurigana: Boolean = true,
    val dailyGoal: Int = 100,
    val notificationsEnabled: Boolean = true,
)
