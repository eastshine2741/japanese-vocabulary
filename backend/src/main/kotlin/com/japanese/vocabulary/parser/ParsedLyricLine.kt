package com.japanese.vocabulary.parser

data class ParsedLyricLine(
    val index: Int,
    val startTimeMs: Long?,
    val text: String
)
