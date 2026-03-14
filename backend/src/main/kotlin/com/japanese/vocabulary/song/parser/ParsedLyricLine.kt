package com.japanese.vocabulary.song.parser

data class ParsedLyricLine(
    val index: Int,
    val startTimeMs: Long?,
    val text: String
)
