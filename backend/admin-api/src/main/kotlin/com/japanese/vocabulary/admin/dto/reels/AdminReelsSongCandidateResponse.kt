package com.japanese.vocabulary.admin.dto.reels

data class AdminReelsSongCandidateResponse(
    val id: Long,
    val title: String,
    val artist: String,
    val durationSeconds: Int?,
    val youtubeUrl: String?,
    val artworkUrl: String?,
    val hasAnalyzedLyrics: Boolean,
    val renderEligible: Boolean,
    val ineligibleReason: String?,
)
