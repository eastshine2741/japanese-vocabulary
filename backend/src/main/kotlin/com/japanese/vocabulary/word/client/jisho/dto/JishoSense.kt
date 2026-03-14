package com.japanese.vocabulary.word.client.jisho.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonProperty

@JsonIgnoreProperties(ignoreUnknown = true)
data class JishoSense(
    @JsonProperty("english_definitions")
    val englishDefinitions: List<String> = emptyList(),
    @JsonProperty("parts_of_speech")
    val partsOfSpeech: List<String> = emptyList()
)
