package com.japanese.vocabulary.admin.reels.model

data class AdminReelsPromoData(
    val song: AdminReelsPromoSong,
    val headline: String,
    val instagramHandle: String,
    val catchphrase: String,
    val sourceStartFrame: Int,
    /** 없으면 캔버스를 꽉 채운다(cover). */
    val mvFrame: AdminReelsMvFrame? = null,
    /** 마지막 선택 줄이 끝나는 프레임. 이 프레임부터 엔드카드다. */
    val lyricsEndFrame: Int,
    /** 곡 전체 가사 줄 수. 엔드카드 앱 목업의 "n/전체" 표시용. */
    val totalLineCount: Int,
    val lyricLines: List<AdminReelsPromoLine>,
    val wordCount: Int? = null,
)
