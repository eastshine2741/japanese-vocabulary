package com.japanese.vocabulary.admin.dto.reels

data class AdminReelsSongDetailResponse(
    val song: AdminReelsSongCandidateResponse,
    /** SYNCED 면 줄에 startTimeMs 가 있어 에디터 초기 타이밍으로 쓰고, PLAIN 이면 어드민이 전부 찍는다. */
    val lyricType: String,
    /** 에디터 헤드라인의 초기값. 줄바꿈이 줄을 나누고 `<b>…</b>` 구간에 초록 배경이 깔린다. */
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
