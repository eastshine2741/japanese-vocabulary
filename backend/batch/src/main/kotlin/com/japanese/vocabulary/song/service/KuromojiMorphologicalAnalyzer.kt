package com.japanese.vocabulary.song.service

import com.atilika.kuromoji.ipadic.Tokenizer
import com.japanese.vocabulary.song.dto.PartOfSpeech
import com.japanese.vocabulary.song.dto.TokenInfo

class KuromojiMorphologicalAnalyzer : MorphologicalAnalyzer {

    private val tokenizer = Tokenizer()

    override fun analyze(text: String): List<TokenInfo> {
        val tokens = tokenizer.tokenize(text)

        return tokens.mapNotNull { token ->
            val posName = token.partOfSpeechLevel1
            val partOfSpeech = PartOfSpeech.fromSudachiOrNull(posName) ?: return@mapNotNull null
            val surface = token.surface
            val baseForm = token.baseForm
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
