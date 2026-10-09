package com.japanese.vocabulary.songsearch.client.applemusic.dto

data class AppleMusicArtistsResponse(val data: List<Artist> = emptyList()) {
    data class Artist(val id: String, val attributes: ArtistAttributes? = null)
    data class ArtistAttributes(
        val name: String? = null,
        val url: String? = null,
        val artwork: AppleMusicSearchResponse.Artwork? = null,
    )
}
