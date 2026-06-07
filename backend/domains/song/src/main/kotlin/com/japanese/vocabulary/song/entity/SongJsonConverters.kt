package com.japanese.vocabulary.song.entity

import com.japanese.vocabulary.config.converter.JsonListConverter
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.LyricLineData
import jakarta.persistence.Converter

@Converter
class LyricLineDataListConverter : JsonListConverter<LyricLineData>(LyricLineData::class.java)

@Converter
class AnalyzedLineListConverter : JsonListConverter<AnalyzedLine>(AnalyzedLine::class.java)
