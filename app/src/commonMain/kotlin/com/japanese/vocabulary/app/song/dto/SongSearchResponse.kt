package com.japanese.vocabulary.app.song.dto

import kotlinx.serialization.Serializable

@Serializable
data class SongSearchResponse(
    val items: List<SongSearchItem>,
    val nextOffset: Int? = null
)
