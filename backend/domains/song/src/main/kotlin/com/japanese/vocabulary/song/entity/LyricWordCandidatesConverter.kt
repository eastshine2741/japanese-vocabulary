package com.japanese.vocabulary.song.entity

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.japanese.vocabulary.song.model.LyricWordCandidates
import jakarta.persistence.AttributeConverter
import jakarta.persistence.Converter

@Converter
class LyricWordCandidatesConverter : AttributeConverter<LyricWordCandidates?, String?> {
    private val objectMapper = jacksonObjectMapper().findAndRegisterModules()

    override fun convertToDatabaseColumn(attribute: LyricWordCandidates?): String? =
        attribute?.let { objectMapper.writeValueAsString(it) }

    override fun convertToEntityAttribute(dbData: String?): LyricWordCandidates? =
        dbData?.takeUnless { it.isBlank() }?.let { objectMapper.readValue<LyricWordCandidates>(it) }
}
