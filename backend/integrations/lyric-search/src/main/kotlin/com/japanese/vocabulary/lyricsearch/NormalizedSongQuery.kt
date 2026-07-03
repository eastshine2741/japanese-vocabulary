package com.japanese.vocabulary.lyricsearch

data class NormalizedSongQuery(
    val originalTitle: String,
    val originalArtist: String,
    val normalizedTitle: String,
    val artistParts: List<String>,
    val durationSeconds: Int?
)
