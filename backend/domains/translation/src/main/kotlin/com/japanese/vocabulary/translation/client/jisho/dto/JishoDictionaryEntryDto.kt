package com.japanese.vocabulary.translation.client.jisho.dto

/**
 * One jisho dictionary entry, kept whole.
 *
 * An entry is identified by the `(headword, reading)` pair — that pair is what distinguishes 前[マエ]
 * from 前[ゼン], two different words that share a spelling. Matching on the pair is the whole point of
 * this type: the senses under one entry all belong to the same word, so once the pair picks an entry,
 * sense-select only ever sees meanings that word actually has.
 *
 * [reading] is stored as katakana (jisho answers in hiragana; the client normalizes on arrival) so it
 * can be compared against the segmentation stage's katakana readings without converting at every
 * comparison site. [headword] is null for kana-only entries such as メッセージ.
 *
 * [jlpt] sits here rather than on a sense because that is jisho's own granularity.
 */
data class JishoDictionaryEntryDto(
    val headword: String? = null,
    val reading: String? = null,
    val jlpt: List<String> = emptyList(),
    val senses: List<JishoOptionDto> = emptyList(),
)
