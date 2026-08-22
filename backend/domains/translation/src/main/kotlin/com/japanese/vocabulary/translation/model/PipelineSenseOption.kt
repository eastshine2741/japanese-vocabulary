package com.japanese.vocabulary.translation.model

import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance

/**
 * One sense candidate offered to sense-select, already attributed to the dictionary entry it came
 * from. [headword]/[reading] name that entry; [reading] is katakana.
 */
data class PipelineSenseOption(
    val senseId: Int,
    val surface: String,
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
