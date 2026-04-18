package com.japanese.vocabulary.song.client.lrclib.dto

data class LrclibResponse(
    val id: Long,
    val trackName: String,
    val artistName: String,
    val albumName: String?,
    val duration: Int?,
    val instrumental: Boolean,
    val plainLyrics: String?,
    val syncedLyrics: String?
)
