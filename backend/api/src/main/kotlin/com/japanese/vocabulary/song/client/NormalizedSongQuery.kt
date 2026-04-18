package com.japanese.vocabulary.song.client

data class NormalizedSongQuery(
    val originalTitle: String,
    val originalArtist: String,
    val normalizedTitle: String,
    val artistParts: List<String>,
    val durationSeconds: Int?
)
