package com.japanese.vocabulary.songsearch.client.applemusic.dto

data class AppleMusicSearchResponse(val results: Results = Results()) {
    data class Results(val songs: SongPage? = null)
    data class SongPage(val data: List<Song> = emptyList())
    data class Song(val id: String, val attributes: SongAttributes? = null)
    data class SongAttributes(
        val name: String? = null,
        val artistName: String? = null,
        val durationInMillis: Int? = null,
        val artwork: Artwork? = null,
    )
    data class Artwork(val url: String? = null)
}
