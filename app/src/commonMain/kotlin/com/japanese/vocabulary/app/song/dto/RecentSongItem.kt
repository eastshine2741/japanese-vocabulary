package com.japanese.vocabulary.app.song.dto

import kotlinx.serialization.Serializable

@Serializable
data class RecentSongItem(
    val id: Long,
    val title: String,
    val artist: String,
    val artworkUrl: String? = null
)
