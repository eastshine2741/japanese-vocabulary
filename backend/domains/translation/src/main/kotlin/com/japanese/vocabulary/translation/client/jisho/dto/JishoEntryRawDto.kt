package com.japanese.vocabulary.translation.client.jisho.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties

/** A single entry in the jisho search response. */
@JsonIgnoreProperties(ignoreUnknown = true)
data class JishoEntryRawDto(
    val japanese: List<JishoJapaneseDto> = emptyList(),
    val senses: List<JishoSenseDto> = emptyList(),
    val jlpt: List<String> = emptyList(),
)
