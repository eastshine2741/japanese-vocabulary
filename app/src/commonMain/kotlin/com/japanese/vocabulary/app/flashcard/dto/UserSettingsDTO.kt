package com.japanese.vocabulary.app.flashcard.dto

import kotlinx.serialization.Serializable

@Serializable
data class UserSettingsDTO(
    val requestRetention: Double,
    val showIntervals: Boolean = true
)
