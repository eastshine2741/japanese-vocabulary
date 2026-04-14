package com.japanese.vocabulary.config.converter

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.japanese.vocabulary.song.dto.AnalyzedLine
import com.japanese.vocabulary.song.dto.LyricLineData
import com.japanese.vocabulary.user.dto.UserSettingsData
import com.japanese.vocabulary.word.dto.WordMeaning
import jakarta.persistence.AttributeConverter
import jakarta.persistence.Converter

abstract class JsonListConverter<T>(private val elementType: Class<T>) : AttributeConverter<List<T>, String> {
    companion object {
        private val objectMapper = jacksonObjectMapper()
    }

    override fun convertToDatabaseColumn(attribute: List<T>?): String {
        return objectMapper.writeValueAsString(attribute ?: emptyList<T>())
    }

    override fun convertToEntityAttribute(dbData: String?): List<T> {
        if (dbData.isNullOrBlank()) return emptyList()
        return objectMapper.readValue(
            dbData,
            objectMapper.typeFactory.constructCollectionType(List::class.java, elementType)
        )
    }
}

@Converter
class WordMeaningListConverter : JsonListConverter<WordMeaning>(WordMeaning::class.java)

@Converter
class LyricLineDataListConverter : JsonListConverter<LyricLineData>(LyricLineData::class.java)

@Converter
class AnalyzedLineListConverter : JsonListConverter<AnalyzedLine>(AnalyzedLine::class.java)

@Converter
class UserSettingsJsonConverter : AttributeConverter<UserSettingsData, String> {
    companion object {
        private val objectMapper = jacksonObjectMapper()
    }

    override fun convertToDatabaseColumn(attribute: UserSettingsData?): String {
        return objectMapper.writeValueAsString(attribute ?: UserSettingsData())
    }

    override fun convertToEntityAttribute(dbData: String?): UserSettingsData {
        if (dbData.isNullOrBlank()) return UserSettingsData()
        return objectMapper.readValue<UserSettingsData>(dbData)
    }
}
