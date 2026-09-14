package com.japanese.vocabulary.lyricsearch.vocadb.dto

data class VocadbArtistSearchResponse(val items: List<VocadbArtistSearchItemDto>)

data class VocadbArtistSearchItemDto(
    val id: Long,
    val name: String,
    val additionalNames: String? = null,
    val names: List<VocadbNameDto>? = null,
)
