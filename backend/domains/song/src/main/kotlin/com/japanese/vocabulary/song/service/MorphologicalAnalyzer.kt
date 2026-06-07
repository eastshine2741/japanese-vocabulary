package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.song.model.TokenInfo

interface MorphologicalAnalyzer {
    fun analyze(text: String): List<TokenInfo>
}
