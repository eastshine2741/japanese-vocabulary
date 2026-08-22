package com.japanese.vocabulary.translation.client.gemini.dto

/**
 * One segmented + lemmatized word from the LLM segmentation stage.
 *
 * [headword] is the lexical headword with potential/causative/passive forms reduced (消せる→消す), so
 * no derived lemma reaches the dictionary lookup.
 *
 * The two readings are what let a jisho entry be pinned down. An entry is the
 * `(headword, baseFormReading)` pair — 前[マエ] and 前[ゼン] are different words that share a spelling —
 * so [baseFormReading] is half of the lookup key, while [usedReading] is the inflected reading this
 * line actually sings (行って → イッテ) and is what the line's pronunciation string is built from.
 * Both are asked for in katakana and normalized through
 * [com.japanese.vocabulary.translation.service.pipeline.JapaneseText.toKatakana] on arrival.
 *
 * [contextGloss] is a short English hint at the meaning this line uses. It is never shown to a user;
 * it exists only so sense-select can match it against the dictionary's English glosses.
 */
data class SegWordDto(
    val surface: String,
    val headword: String,
    val usedReading: String,
    val baseFormReading: String,
    val contextGloss: String,
)
