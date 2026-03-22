package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.song.dto.TokenInfo
import com.worksap.nlp.sudachi.Dictionary
import com.worksap.nlp.sudachi.Tokenizer.SplitMode
import org.springframework.context.annotation.Primary
import org.springframework.stereotype.Component

@Component("sudachi")
@Primary
class SudachiMorphologicalAnalyzer(
    private val sudachiDictionary: Dictionary
) : MorphologicalAnalyzer {

    private val includedPosTypes = setOf("名詞", "動詞", "形容詞", "形状詞")

    override fun analyze(text: String): List<TokenInfo> {
        val tokenizer = sudachiDictionary.create()
        val morphemes = tokenizer.tokenize(SplitMode.B, text)

        return morphemes
            .filter { morpheme ->
                val pos = morpheme.partOfSpeech()
                pos.isNotEmpty() && pos[0] in includedPosTypes
            }
            .map { morpheme ->
                TokenInfo(
                    surface = morpheme.surface(),
                    baseForm = morpheme.dictionaryForm(),
                    reading = morpheme.readingForm().ifEmpty { null },
                    partOfSpeech = morpheme.partOfSpeech()[0],
                    charStart = morpheme.begin(),
                    charEnd = morpheme.end()
                )
            }
    }
}
