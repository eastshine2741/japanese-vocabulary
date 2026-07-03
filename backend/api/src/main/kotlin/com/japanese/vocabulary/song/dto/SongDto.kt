package com.japanese.vocabulary.song.dto

import com.japanese.vocabulary.song.entity.LyricType

data class SongDto(
    val id: Long,
    val title: String,
    val artist: String,
    val durationSeconds: Int?,
    val artworkUrl: String?,
    val youtubeUrl: String?,
    val lyricType: LyricType,
)
