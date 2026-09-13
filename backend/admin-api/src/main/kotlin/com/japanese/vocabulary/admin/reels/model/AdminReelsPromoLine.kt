package com.japanese.vocabulary.admin.reels.model

import com.japanese.vocabulary.admin.dto.reels.AdminReelsVocabularyResponse

data class AdminReelsPromoLine(
    val startFrame: Int,
    /** 곡 안에서 몇 번째 줄인지(1-based). 엔드카드 앱 목업의 페이지 표시용. */
    val lineNumber: Int,
    val originalText: String,
    val koreanLyrics: String,
    val tokens: List<AdminReelsPromoToken>,
    val vocabulary: List<AdminReelsVocabularyResponse>,
)
