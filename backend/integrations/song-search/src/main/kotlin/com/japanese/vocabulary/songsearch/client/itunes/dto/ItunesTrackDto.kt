package com.japanese.vocabulary.songsearch.client.itunes.dto

data class ItunesTrackDto(
    val trackId: Long?,
    val trackName: String?,
    val artistName: String?,
    val artworkUrl100: String?,
    val trackTimeMillis: Int?
)
