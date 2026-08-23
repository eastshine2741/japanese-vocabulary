package com.japanese.vocabulary.song.dto.songdetail

data class SongLyricsDto(
    val lyricId: Long,
    val lyricsSourceName: String?,
    val lyricsSourceUrl: String?,
    val lines: List<SongLyricLineDto>,
)
