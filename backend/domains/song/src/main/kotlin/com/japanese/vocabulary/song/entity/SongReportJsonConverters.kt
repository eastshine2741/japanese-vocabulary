package com.japanese.vocabulary.song.entity

import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.japanese.vocabulary.song.model.SongReportChange
import com.japanese.vocabulary.song.model.SongReportTarget
import jakarta.persistence.AttributeConverter
import jakarta.persistence.Converter

private val reportObjectMapper = jacksonObjectMapper().disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)

@Converter
class SongReportTargetConverter : AttributeConverter<SongReportTarget?, String?> {
    override fun convertToDatabaseColumn(attribute: SongReportTarget?): String? =
        attribute?.let { reportObjectMapper.writeValueAsString(it) }

    override fun convertToEntityAttribute(dbData: String?): SongReportTarget? =
        dbData?.takeUnless { it.isBlank() }?.let { reportObjectMapper.readValue<SongReportTarget>(it) }
}

@Converter
class SongReportChangesConverter : AttributeConverter<List<SongReportChange>?, String?> {
    override fun convertToDatabaseColumn(attribute: List<SongReportChange>?): String? =
        attribute?.let { reportObjectMapper.writeValueAsString(it) }

    override fun convertToEntityAttribute(dbData: String?): List<SongReportChange>? =
        dbData?.takeUnless { it.isBlank() }?.let { reportObjectMapper.readValue<List<SongReportChange>>(it) }
}
