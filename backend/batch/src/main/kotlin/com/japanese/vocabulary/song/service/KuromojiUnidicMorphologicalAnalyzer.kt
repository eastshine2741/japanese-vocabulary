package com.japanese.vocabulary.song.service

import com.atilika.kuromoji.unidic.Tokenizer
import com.japanese.vocabulary.song.dto.PartOfSpeech
import com.japanese.vocabulary.song.dto.TokenInfo

class KuromojiUnidicMorphologicalAnalyzer : MorphologicalAnalyzer {

    private val tokenizer = Tokenizer()

    override fun analyze(text: String): List<TokenInfo> {
        val tokens = tokenizer.tokenize(text)

        return tokens.mapNotNull { token ->
            val posName = token.partOfSpeechLevel1
            val partOfSpeech = PartOfSpeech.fromJapaneseOrNull(posName) ?: return@mapNotNull null
            val surface = token.surface
            val baseForm = token.writtenBaseForm.takeIf { it != "*" } ?: token.lemma.takeIf { it != "*" } ?: surface
            val reading = token.lemmaReadingForm.takeIf { it != "*" }
            val baseFormReading = reading
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
