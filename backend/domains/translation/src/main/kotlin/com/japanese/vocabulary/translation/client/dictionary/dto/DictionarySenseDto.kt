package com.japanese.vocabulary.translation.client.dictionary.dto

/**
 * One dictionary sense: POS and English gloss only. Headword, reading, and JLPT belong to the owning
 * [DictionaryEntryDto]; copying them onto senses would erase the entry boundary.
 *
 * Deserialized from the dictionary file's sense JSON, so the field names are that file's format.
 */
data class DictionarySenseDto(
    val pos: List<String> = emptyList(),
    val english: String = "",
    val englishDefinitions: List<String> = emptyList(),
)
