package com.japanese.vocabulary.translation.client.gemini.dto

/**
 * One segmented + lemmatized word from the LLM segmentation stage.
 *
 * [headword] has potential/causative/passive forms reduced (消せる→消す).
 * [baseFormReading] is half of the `(headword, baseFormReading)` jisho key; [usedReading] is the
 * inflected reading actually sung (行って → イッテ) and feeds the line's pronunciation. Both are
 * normalized through [com.japanese.vocabulary.translation.service.pipeline.JapaneseText.toKatakana].
 * [contextGloss] is an English hint never shown to users; sense-select matches it against dictionary glosses.
 */
data class SegWordDto(
    val surface: String,
    val headword: String,
    val usedReading: String,
    val baseFormReading: String,
    val contextGloss: String,
)
