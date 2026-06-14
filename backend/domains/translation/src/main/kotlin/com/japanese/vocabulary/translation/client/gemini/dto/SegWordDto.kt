package com.japanese.vocabulary.translation.client.gemini.dto

/**
 * One segmented + lemmatized word from the LLM segmentation stage (redesign stage 1).
 * [dictionaryForm] is the lexical headword with potential/causative/passive forms reduced
 * (消せる→消す), so criterion #1 (no derived lemmas) is satisfied at the source.
 * Reading is no longer produced here — it comes from the jisho option chosen downstream.
 */
data class SegWordDto(
    val surface: String,
    val dictionaryForm: String,
)
