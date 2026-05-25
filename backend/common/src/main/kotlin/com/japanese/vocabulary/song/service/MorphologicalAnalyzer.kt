package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.song.dto.TokenInfo

interface MorphologicalAnalyzer {
    fun analyze(text: String): List<TokenInfo>
}
