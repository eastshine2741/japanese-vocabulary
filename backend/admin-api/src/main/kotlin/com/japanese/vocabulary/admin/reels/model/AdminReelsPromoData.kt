package com.japanese.vocabulary.admin.reels.model

data class AdminReelsPromoData(
    val song: AdminReelsPromoSong,
    val headline: String,
    val instagramHandle: String,
    val catchphrase: String,
    val sourceStartFrame: Int,
    val lyricLines: List<AdminReelsPromoLine>,
    val wordCount: Int? = null,
)
