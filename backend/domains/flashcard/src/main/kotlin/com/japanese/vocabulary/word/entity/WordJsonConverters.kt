package com.japanese.vocabulary.word.entity

import com.japanese.vocabulary.config.converter.JsonListConverter
import com.japanese.vocabulary.word.model.WordMeaning
import jakarta.persistence.Converter

@Converter
class WordMeaningListConverter : JsonListConverter<WordMeaning>(WordMeaning::class.java)
