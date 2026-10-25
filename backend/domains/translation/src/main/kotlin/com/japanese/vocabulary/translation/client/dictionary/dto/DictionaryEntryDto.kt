package com.japanese.vocabulary.translation.client.dictionary.dto

/**
 * One dictionary entry, identified by the `(headword, reading)` pair (前[マエ] vs 前[ゼン]).
 * [reading] is katakana (normalized on arrival). [headword] is null for kana-only entries such as メッセージ.
 * [jlpt] lives here, not on a sense, because tanos assigns it per entry.
 */
data class DictionaryEntryDto(
    val headword: String? = null,
    val reading: String? = null,
    val jlpt: List<String> = emptyList(),
    val senses: List<DictionarySenseDto> = emptyList(),
)
