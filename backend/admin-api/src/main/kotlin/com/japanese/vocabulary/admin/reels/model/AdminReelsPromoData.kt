package com.japanese.vocabulary.admin.reels.model

data class AdminReelsPromoData(
    val song: AdminReelsPromoSong,
    /** 상단 띠 헤드라인. 줄바꿈이 줄을 나누고 `<b>…</b>` 구간에 초록 배경이 깔린다. 어드민이 쓴 그대로 믿는다. */
    val headline: String,
    /** 상단 헤드라인 글자 크기(px). 없으면 기본 크기. 엔드카드 헤드라인은 고정 문구라 영향이 없다. */
    val headlineFontSize: Int? = null,
    val instagramHandle: String,
    val catchphrase: String,
    val sourceStartFrame: Int,
    /** 없으면 캔버스를 꽉 채운다(cover). */
    val mvFrame: AdminReelsMvFrame? = null,
    /** 가사 원문 글자 배율. 없으면 1(기본 크기). 긴 줄을 맞추는 자동 축소 위에 곱해진다. */
    val lyricScale: Double? = null,
    /** 마지막 선택 줄이 끝나는 프레임. 이 프레임부터 엔드카드다. */
    val lyricsEndFrame: Int,
    /** 곡 전체 가사 줄 수. 엔드카드 앱 목업의 "n/전체" 표시용. */
    val totalLineCount: Int,
    val lyricLines: List<AdminReelsPromoLine>,
    val wordCount: Int? = null,
)
