package com.japanese.vocabulary.translation.client.jisho.dto

/**
 * One dictionary sense: its POS and English gloss, nothing more.
 *
 * Headword, reading, and JLPT deliberately do NOT live here — they belong to the
 * [JishoDictionaryEntryDto] that owns this sense. A jisho entry bundles every spelling/reading pair
 * it has (`前` carries 前[マエ]; the `先` entry also lists 前 as an alternate spelling), and jisho
 * reports `jlpt` per entry, not per sense. Copying those onto each sense is what erased the entry
 * boundary and let a lookup for 前 answer with 先[サキ]'s meanings.
 *
 * Plain Jackson-serializable so it can be cached in Redis.
 */
data class JishoOptionDto(
    val pos: List<String> = emptyList(),
    val english: String = "",
    val englishDefinitions: List<String> = emptyList(),
)
