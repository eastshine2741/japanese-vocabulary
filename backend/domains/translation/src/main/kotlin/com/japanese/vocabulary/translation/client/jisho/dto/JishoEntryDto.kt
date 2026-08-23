package com.japanese.vocabulary.translation.client.jisho.dto

/**
 * Distilled jisho.org lookup result for a single queried form.
 *
 * [entries] keeps jisho's entry boundaries intact — one element per dictionary entry the query
 * touched, each holding its own headword/reading/JLPT and only its own senses. The caller
 * ([com.japanese.vocabulary.translation.service.pipeline.LexicalResolver]) then narrows to the entry
 * whose `(headword, reading)` pair matches the segmented word. The query alone cannot do that
 * narrowing: several tokens share one headword lookup while disagreeing on reading, so the cached
 * value has to carry every entry the headword can mean.
 *
 * This is the value cached in Redis, so it must be a plain Jackson-serializable data class.
 */
data class JishoEntryDto(
    val found: Boolean = false,
    val word: String = "",
    val entries: List<JishoDictionaryEntryDto> = emptyList(),
    val provenance: JishoLookupProvenance = JishoLookupProvenance.NOT_FOUND,
    val rejectedFallbackReason: String? = null,
)
