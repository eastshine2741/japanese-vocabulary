package com.japanese.vocabulary.song.dto

data class SongSearchItemDto(
    val id: String,
    val title: String,
    val thumbnail: String,
    val artistName: String,
    val durationSeconds: Int
)
