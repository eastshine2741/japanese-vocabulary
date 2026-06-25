package com.japanese.vocabulary.song.dto

data class RecentSongDto(
    val id: Long,
    val title: String,
    val artist: String,
    val artworkUrl: String?,
)
