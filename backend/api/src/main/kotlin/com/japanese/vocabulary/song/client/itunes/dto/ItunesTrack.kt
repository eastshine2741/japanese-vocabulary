package com.japanese.vocabulary.song.client.itunes.dto

data class ItunesTrack(
    val trackId: Long?,
    val trackName: String?,
    val artistName: String?,
    val artworkUrl100: String?,
    val trackTimeMillis: Int?
)
