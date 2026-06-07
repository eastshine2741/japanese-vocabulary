package com.japanese.vocabulary.translation.service

import com.japanese.vocabulary.translation.model.TokenInfo

interface MorphologicalAnalyzer {
    fun analyze(text: String): List<TokenInfo>
}
