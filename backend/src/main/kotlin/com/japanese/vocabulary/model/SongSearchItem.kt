package com.japanese.vocabulary.model

data class SongSearchItem(
    val id: String,
    val title: String,
    val thumbnail: String,
    val channelTitle: String,
    val durationSeconds: Int
)
