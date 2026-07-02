package com.japanese.vocabulary.translation.client.jisho.dto

/**
 * Distilled jisho.org lookup result for a single dictionary form.
 * Mirrors the playground `_jisho_full_fetch` return shape:
 *   { found, word, options:[{reading, pos[], english, jlpt[]}] }
 * - [options] flattens EVERY sense of EVERY exact-match entry (homographs included); the sense-select
 *   LLM later chooses one. If no entry exactly matches, [options] holds jisho's top fuzzy entry's senses.
 * This is the value cached in Redis, so it must be a plain Jackson-serializable data class.
 */
data class JishoEntryDto(
    val found: Boolean = false,
    val word: String = "",
    val options: List<JishoOptionDto> = emptyList(),
    val provenance: JishoLookupProvenance = JishoLookupProvenance.NOT_FOUND,
    val rejectedFallbackReason: String? = null,
)
