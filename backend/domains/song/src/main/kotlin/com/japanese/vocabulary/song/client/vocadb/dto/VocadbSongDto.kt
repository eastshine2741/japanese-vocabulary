package com.japanese.vocabulary.song.client.vocadb.dto

data class VocadbSongDto(
    val id: Long,
    val name: String,
    val artistString: String,
    val lyrics: List<VocadbLyricsDto>?,
    val lengthSeconds: Int? = null,
    val names: List<VocadbNameDto>? = null,
    val artists: List<VocadbArtistForSongDto>? = null,
    val pvs: List<VocadbPvDto>? = null,
    val webLinks: List<VocadbWebLinkDto>? = null,
)

data class VocadbNameDto(
    val language: String?,
    val value: String,
)

data class VocadbArtistForSongDto(
    val name: String,
    val categories: String? = null,
    val roles: String? = null,
    val effectiveRoles: String? = null,
    val artist: VocadbArtistDto? = null,
)

data class VocadbArtistDto(
    val id: Long? = null,
    val name: String,
    val additionalNames: String? = null,
)

data class VocadbPvDto(
    val name: String? = null,
    val author: String? = null,
    val description: String? = null,
    val url: String? = null,
)

data class VocadbWebLinkDto(
    val category: String? = null,
    val description: String? = null,
    val url: String? = null,
)
