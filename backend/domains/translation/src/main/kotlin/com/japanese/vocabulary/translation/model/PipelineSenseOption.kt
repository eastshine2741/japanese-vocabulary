package com.japanese.vocabulary.translation.model

import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance

/**
 * One sense candidate offered to sense-select; [headword]/[reading] (katakana) name its source entry.
 * Shared by every token with this sense, so it holds nothing occurrence-scoped.
 */
data class PipelineSenseOption(
    val senseId: Int,
    val baseForm: String,
    val headword: String?,
    val reading: String?,
    val partOfSpeech: PartOfSpeech,
    val rawPos: List<String>,
    val english: String,
    val englishDefinitions: List<String>,
    val jlpt: List<String>,
    val provenance: JishoLookupProvenance,
)
