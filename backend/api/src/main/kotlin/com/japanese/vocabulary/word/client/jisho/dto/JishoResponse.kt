package com.japanese.vocabulary.word.client.jisho.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties

@JsonIgnoreProperties(ignoreUnknown = true)
data class JishoResponse(
    val data: List<JishoEntry> = emptyList()
)
