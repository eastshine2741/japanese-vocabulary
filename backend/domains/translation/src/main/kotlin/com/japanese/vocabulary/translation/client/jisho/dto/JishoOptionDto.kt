package com.japanese.vocabulary.translation.client.jisho.dto

/**
 * One jisho sense flattened into a standalone option: a single dictionary sense carrying its own
 * reading / POS / English gloss / JLPT. Mirrors the playground `_flatten_entry` element shape.
 * The sense-select LLM picks ONE option (by global senseId) per word; code then reads reading/pos/jlpt
 * from the chosen option deterministically. Plain Jackson-serializable so it can be cached in Redis.
 */
data class JishoOptionDto(
    val reading: String? = null,
    val pos: List<String> = emptyList(),
    val english: String = "",
    val jlpt: List<String> = emptyList(),
    val englishDefinitions: List<String> = emptyList(),
)
