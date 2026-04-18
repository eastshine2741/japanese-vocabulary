package com.japanese.vocabulary.song.dto

data class RecentSongItem(
    val id: Long,
    val title: String,
    val artist: String,
    val artworkUrl: String?
)
