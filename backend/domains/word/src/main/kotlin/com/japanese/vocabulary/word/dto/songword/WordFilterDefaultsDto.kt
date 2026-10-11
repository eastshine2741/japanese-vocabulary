package com.japanese.vocabulary.word.dto.songword

data class WordFilterDefaultsDto(
    val pos: List<String> = listOf("NOUN", "VERB", "ADJECTIVE", "NA_ADJECTIVE", "ADVERB"),
    val jlpt: List<String> = listOf("N1", "N2", "N3", "N4", "N5"),
    val includeUnknownJlpt: Boolean = true,
    val sortDefault: String = "APPEARANCE",
)
