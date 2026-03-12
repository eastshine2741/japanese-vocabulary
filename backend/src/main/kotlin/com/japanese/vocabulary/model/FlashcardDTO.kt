package com.japanese.vocabulary.model

data class FlashcardDTO(
    val id: Long,
    val wordId: Long,
    val japanese: String,
    val reading: String?,
    val koreanText: String?,
    val songTitle: String? = null,
    val lyricLine: String? = null,
    val state: Int,
    val due: String,
    val intervals: Map<Int, String>? = null
)

data class DueFlashcardsResponse(
    val cards: List<FlashcardDTO>,
    val totalCount: Int
)

data class ReviewRequest(
    val rating: Int
)

data class ReviewResponse(
    val id: Long,
    val state: Int,
    val due: String,
    val stability: Double,
    val difficulty: Double
)

data class FlashcardStatsResponse(
    val total: Long,
    val due: Long,
    val newCount: Long,
    val learning: Long,
    val review: Long
)

data class UserSettingsDTO(
    val requestRetention: Double,
    val showIntervals: Boolean = true
)
