package com.japanese.vocabulary.model

data class SongSearchResponse(
    val items: List<SongSearchItem>,
    val nextOffset: Int?
)
