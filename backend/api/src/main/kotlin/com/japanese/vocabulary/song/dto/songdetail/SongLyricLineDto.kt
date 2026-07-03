package com.japanese.vocabulary.song.dto.songdetail

data class SongLyricLineDto(
    val index: Int,
    val originalText: String,
    val startTimeMs: Long?,
    val koreanLyrics: String?,
    val koreanPronounciation: String?,
)
