package com.japanese.vocabulary.song.client.vocadb.dto

data class VocadbSongDto(
    val id: Long,
    val name: String,
    val artistString: String,
    val lyrics: List<VocadbLyricsDto>?
)
