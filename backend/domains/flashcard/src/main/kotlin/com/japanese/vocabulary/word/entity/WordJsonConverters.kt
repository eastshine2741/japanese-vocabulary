package com.japanese.vocabulary.word.entity

import com.japanese.vocabulary.config.converter.JsonListConverter
import com.japanese.vocabulary.word.model.WordSense
import jakarta.persistence.Converter

@Converter
class WordSenseListConverter : JsonListConverter<WordSense>(WordSense::class.java)
