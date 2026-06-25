package com.japanese.vocabulary.admin.reels.model

import com.japanese.vocabulary.admin.dto.reels.AdminReelsVocabularyResponse

data class AdminReelsPromoLine(
    val startFrame: Int,
    val originalText: String,
    val koreanLyrics: String,
    val tokens: List<AdminReelsPromoToken>,
    val vocabulary: List<AdminReelsVocabularyResponse>,
)
