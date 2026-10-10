package com.japanese.vocabulary.rewardcard.entity

import com.japanese.vocabulary.config.converter.JsonListConverter
import jakarta.persistence.Converter

@Converter
class IntListConverter : JsonListConverter<Int>(Int::class.javaObjectType)

@Converter
class StringListConverter : JsonListConverter<String>(String::class.java)
