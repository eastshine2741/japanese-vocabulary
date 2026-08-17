package com.japanese.vocabulary.translation.client.jisho.dto

/**
 * One jisho sense flattened into a standalone option: a single dictionary sense carrying its own
 * headword / reading / POS / English gloss / JLPT. Mirrors the playground `_flatten_entry` element shape.
 * The sense-select LLM picks ONE option (by global senseId) per word; code then reads reading/pos/jlpt
 * from the chosen option deterministically. Plain Jackson-serializable so it can be cached in Redis.
 *
 * [headword] and [reading] come from the `japanese[]` element that actually matched the queried form,
 * NOT from `japanese[0]`. A jisho entry bundles several spellings and readings (e.g. `言` carries both
 * 言[げん] and 言[こと]), and a single query can match any of them — reading the first element attributes
 * the wrong reading to the word. [headword] is null for kana-only entries (e.g. メッセージ).
 */
data class JishoOptionDto(
    val headword: String? = null,
    val reading: String? = null,
    val pos: List<String> = emptyList(),
    val english: String = "",
    val jlpt: List<String> = emptyList(),
    val englishDefinitions: List<String> = emptyList(),
)
