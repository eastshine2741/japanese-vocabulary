package com.japanese.vocabulary.applemusicrss.client.dto

data class AppleMusicRssSongDto(
    val id: String,
    val name: String,
    val artistName: String,
    val artistId: String? = null,
    val artistUrl: String? = null,
    val artworkUrl100: String? = null,
    val url: String? = null,
    val releaseDate: String? = null,
    val genres: List<AppleMusicRssGenreDto> = emptyList(),
)
