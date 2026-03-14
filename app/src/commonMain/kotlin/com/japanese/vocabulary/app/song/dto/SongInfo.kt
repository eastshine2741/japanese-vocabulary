package com.japanese.vocabulary.app.song.dto

import kotlinx.serialization.Serializable

@Serializable
data class SongInfo(
    val id: Long,
    val title: String,
    val artist: String,
    val lyricType: String
)
