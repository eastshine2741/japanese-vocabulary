package com.japanese.vocabulary.translation.client.jev.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonProperty

@JsonIgnoreProperties(ignoreUnknown = true)
data class JevResponse(
    val model: String? = null,
    val answers: Map<String, JevAnswer> = emptyMap(),
    val usage: JevUsage? = null,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class JevUsage(
    @JsonProperty("input_tokens") val inputTokens: Long = 0,
    @JsonProperty("output_tokens") val outputTokens: Long = 0,
)
