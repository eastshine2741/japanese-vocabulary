package com.japanese.vocabulary.word.client.jisho.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties

@JsonIgnoreProperties(ignoreUnknown = true)
data class JishoEntry(
    val japanese: List<JishoJapanese> = emptyList(),
    val senses: List<JishoSense> = emptyList(),
    val tags: List<String> = emptyList()
)
