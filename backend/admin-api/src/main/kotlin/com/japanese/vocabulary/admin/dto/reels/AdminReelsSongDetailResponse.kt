package com.japanese.vocabulary.admin.dto.reels

data class AdminReelsSongDetailResponse(
    val song: AdminReelsSongCandidateResponse,
    /** SYNCED 면 줄에 startTimeMs 가 있어 에디터 초기 타이밍으로 쓰고, PLAIN 이면 어드민이 전부 찍는다. */
    val lyricType: String,
    val headline: String,
    val instagramHandle: String,
    val catchphrase: String,
    val fps: Int,
    val minLineCount: Int,
    val maxLineCount: Int?,
    val maxLyricsSpanMs: Long,
    val maxVocabularyPerLine: Int,
    val lines: List<AdminReelsLyricLineResponse>,
)
