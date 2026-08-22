package com.japanese.vocabulary.translation.client.gemini.dto

/**
 * One word after sense-selection (redesign stage 3). The LLM echoes [tokenId] and picks [senseId] =
 * the global id of the jisho option that fits this line's context, or -1 when none fits / the word
 * was not found in jisho. The LLM never writes the Korean meaning itself.
 *
 * surface/headword are deliberately NOT part of this response. Echoing them doubled the output
 * size of the largest call in the pipeline (which made long songs stop mid-array), and added no
 * verification: [tokenId] is `lineIndex:charStart:charEnd:surface`, so matching it already pins the
 * surface, and the headword was only ever compared against the value the request supplied.
 */
data class SelectWordDto(
    val senseId: Int,
    val tokenId: String,
)
