package com.japanese.vocabulary.translation.model

import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance

/**
 * One sense candidate offered to sense-select, already attributed to the dictionary entry it came
 * from. [headword]/[reading] name that entry; [reading] is katakana.
 *
 * One instance is shared by every token that means this sense, so it holds nothing occurrence-scoped
 * — the surface as sung lives on the token, not here.
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
