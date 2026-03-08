package com.japanese.vocabulary.model

data class SongSearchItem(
    val id: String,
    val title: String,
    val thumbnail: String,
    val artistName: String,
    val durationSeconds: Int
)
