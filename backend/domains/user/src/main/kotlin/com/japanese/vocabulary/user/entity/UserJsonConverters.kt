package com.japanese.vocabulary.user.entity

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.japanese.vocabulary.user.model.UserSettingsData
import jakarta.persistence.AttributeConverter
import jakarta.persistence.Converter

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
