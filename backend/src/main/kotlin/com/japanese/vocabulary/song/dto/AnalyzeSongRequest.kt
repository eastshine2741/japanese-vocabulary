package com.japanese.vocabulary.song.dto

data class AnalyzeSongRequest(
    val title: String,
    val artist: String,
    val durationSeconds: Int? = null,
    val artworkUrl: String? = null
)
