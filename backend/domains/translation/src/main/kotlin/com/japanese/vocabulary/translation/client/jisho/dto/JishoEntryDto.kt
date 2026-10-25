package com.japanese.vocabulary.translation.client.jisho.dto

/**
 * Dictionary lookup result for a single queried form, in the shape jisho.org lookups had.
 *
 * [entries] has one element per dictionary entry the query touched. Several tokens share one
 * headword lookup with different readings, so [com.japanese.vocabulary.translation.service.pipeline.LexicalResolver]
 * narrows by `(headword, reading)` afterwards.
 */
data class JishoEntryDto(
    val found: Boolean = false,
    val word: String = "",
    val entries: List<JishoDictionaryEntryDto> = emptyList(),
    val provenance: JishoLookupProvenance = JishoLookupProvenance.NOT_FOUND,
    val rejectedFallbackReason: String? = null,
)
