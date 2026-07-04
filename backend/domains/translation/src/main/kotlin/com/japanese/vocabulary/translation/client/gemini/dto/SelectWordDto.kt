package com.japanese.vocabulary.translation.client.gemini.dto

/**
 * One word after sense-selection (redesign stage 3). The LLM copies surface/dictionaryForm and
 * picks [senseId] = the global id of the jisho option that fits this line's context, or -1 when
 * none fits / the word was not found in jisho. The LLM never writes the Korean meaning itself.
 */
data class SelectWordDto(
    val surface: String,
    val dictionaryForm: String,
    val senseId: Int,
    val tokenId: String,
)
