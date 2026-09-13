package com.japanese.vocabulary.admin.dto.reels

data class AdminReelsLyricLineResponse(
    val index: Int,
    val startTimeMs: Long?,
    val originalText: String,
    val koreanLyrics: String?,
    val tokens: List<AdminReelsLyricTokenResponse>,
    val recommendedVocabulary: List<AdminReelsVocabularyResponse>,
    val selectable: Boolean,
    val ineligibleReason: String?,
)
