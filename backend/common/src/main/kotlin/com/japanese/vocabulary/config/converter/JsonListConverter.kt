package com.japanese.vocabulary.config.converter

import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import jakarta.persistence.AttributeConverter

abstract class JsonListConverter<T>(private val elementType: Class<T>) : AttributeConverter<List<T>, String> {
    companion object {
        /**
         * Unknown keys are ignored so a field can be dropped from a model without breaking the rows
         * already written with it. Jackson fails on them by default, which would turn every removal
         * into a data migration: rows keep the old key until something rewrites them, and reading one
         * would throw. New keys were always safe (they read back as the Kotlin default); this makes
         * removals safe too.
         */
        private val objectMapper = jacksonObjectMapper()
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
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
