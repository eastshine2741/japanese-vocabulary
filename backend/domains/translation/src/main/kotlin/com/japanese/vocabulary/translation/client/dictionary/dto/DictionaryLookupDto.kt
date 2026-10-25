package com.japanese.vocabulary.translation.client.dictionary.dto

/**
 * Dictionary lookup result for a single queried form.
 *
 * [entries] has one element per dictionary entry the query touched. Several tokens share one
 * headword lookup with different readings, so [com.japanese.vocabulary.translation.service.pipeline.LexicalResolver]
 * narrows by `(headword, reading)` afterwards.
 */
data class DictionaryLookupDto(
    val found: Boolean = false,
    val word: String = "",
    val entries: List<DictionaryEntryDto> = emptyList(),
    val provenance: DictionaryLookupProvenance = DictionaryLookupProvenance.NOT_FOUND,
    val rejectedFallbackReason: String? = null,
)
