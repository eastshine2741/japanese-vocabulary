package com.japanese.vocabulary.song.client.vocadb.dto

data class VocadbLyrics(
    val id: Long,
    val cultureCodes: List<String>,
    val translationType: String,
    val value: String?
)
