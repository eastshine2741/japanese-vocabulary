package com.japanese.vocabulary.translation.client.jisho.dto

/**
 * Distilled jisho.org lookup result for a single dictionary form.
 * Mirrors the playground `_jisho_fetch` return shape (exact-match only, first matching entry):
 *   { found, word, pos, jlpt, senses }
 * - [pos]/[senses] come from the first sense block; [senses] are EN definition strings.
 * This is the value cached in Redis, so it must be a plain Jackson-serializable data class.
 */
data class JishoEntryDto(
    val found: Boolean = false,
    val word: String = "",
    val pos: List<String> = emptyList(),
    val jlpt: List<String> = emptyList(),
    val senses: List<String> = emptyList(),
)
