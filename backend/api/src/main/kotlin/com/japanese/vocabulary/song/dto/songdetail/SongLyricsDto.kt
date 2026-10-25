package com.japanese.vocabulary.song.dto.songdetail

data class SongLyricsDto(
    val lyricId: Long,
    val lyricsSourceName: String?,
    val lyricsSourceUrl: String?,
    /** 줄 시각이 곡의 지금 MV 에 맞춘 값인지. false 면 가사 원래 시각(앨범 음원 기준)이라 MV 와 몇 초씩 어긋날 수 있다. */
    val mvSynced: Boolean,
    val lines: List<SongLyricLineDto>,
)
