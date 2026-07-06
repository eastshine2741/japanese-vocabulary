package com.japanese.vocabulary.translation.model

import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import com.japanese.vocabulary.translation.client.jisho.dto.JishoOptionDto

data class PipelineSenseOption(
    val senseId: Int,
    val surface: String,
    val baseForm: String,
    val reading: String?,
    val partOfSpeech: PartOfSpeech,
    val rawPos: List<String>,
    val english: String,
    val englishDefinitions: List<String>,
    val jlpt: List<String>,
    val provenance: JishoLookupProvenance,
    val option: JishoOptionDto,
)
