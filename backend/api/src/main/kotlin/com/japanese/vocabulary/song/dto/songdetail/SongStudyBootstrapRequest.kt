package com.japanese.vocabulary.song.dto.songdetail

data class SongStudyBootstrapRequest(
    val rating: Int,
    /** 곡 상세에서 고른 단어의 표제어. null 이면 중요도 1위를 lead 로 고른다. */
    val leadJapanese: String? = null,
)
