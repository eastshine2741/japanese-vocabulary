package com.japanese.vocabulary.translation.client.jisho.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties

/** The `japanese` block of a jisho entry: a written form and/or its reading. */
@JsonIgnoreProperties(ignoreUnknown = true)
data class JishoJapaneseDto(
    val word: String? = null,
    val reading: String? = null,
)
