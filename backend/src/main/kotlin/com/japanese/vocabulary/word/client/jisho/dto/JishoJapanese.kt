package com.japanese.vocabulary.word.client.jisho.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties

@JsonIgnoreProperties(ignoreUnknown = true)
data class JishoJapanese(
    val word: String? = null,
    val reading: String? = null
)
