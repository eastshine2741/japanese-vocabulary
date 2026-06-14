package com.japanese.vocabulary.translation.client.jisho.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonProperty

/** A single sense block of a jisho entry. */
@JsonIgnoreProperties(ignoreUnknown = true)
data class JishoSenseDto(
    @param:JsonProperty("english_definitions")
    @get:JsonProperty("english_definitions")
    val englishDefinitions: List<String> = emptyList(),
    @param:JsonProperty("parts_of_speech")
    @get:JsonProperty("parts_of_speech")
    val partsOfSpeech: List<String> = emptyList(),
)
