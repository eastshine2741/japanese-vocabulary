package com.japanese.vocabulary.song.client.vocadb.dto

data class VocadbLyricsDto(
    val id: Long,
    val cultureCodes: List<String>,
    val translationType: String,
    val value: String?
)
