package com.japanese.vocabulary.songsearch.dto

data class CatalogArtistDto(
    val id: String,
    val name: String,
    /** Some catalog artists have no photo. */
    val artworkUrl: String?,
    val url: String?,
)
