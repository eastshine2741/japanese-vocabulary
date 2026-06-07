package com.japanese.vocabulary.translation.service

import com.atilika.kuromoji.ipadic.Tokenizer
import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.translation.model.TokenInfo

class KuromojiMorphologicalAnalyzer : MorphologicalAnalyzer {

    private val tokenizer = Tokenizer()

    override fun analyze(text: String): List<TokenInfo> {
        val tokens = tokenizer.tokenize(text)

        return tokens.mapNotNull { token ->
            val posName = token.partOfSpeechLevel1
            val partOfSpeech = PartOfSpeech.fromJapaneseOrNull(posName) ?: return@mapNotNull null
            val surface = token.surface
            // Kuromoji returns "*" for OOV tokens (proper nouns, onomatopoeia,
            // slang). Fall back to surface so downstream consumers don't see
            // a meaningless "*" sentinel. Mirrors the UniDic analyzer.
            val baseForm = token.baseForm.takeIf { it != "*" } ?: surface
            val reading = token.reading.takeIf { it != "*" }
            val baseFormReading = if (surface == baseForm) {
                reading
            } else {
                tokenizer.tokenize(baseForm)
                    .mapNotNull { it.reading.takeIf { r -> r != "*" } }
                    .joinToString("")
                    .ifEmpty { null }
            }
            TokenInfo(
                surface = surface,
                baseForm = baseForm,
                reading = reading,
                baseFormReading = baseFormReading,
                partOfSpeech = partOfSpeech,
                charStart = token.position,
                charEnd = token.position + surface.length
            )
        }
    }
}
