package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.song.dto.PartOfSpeech
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

    override fun analyze(text: String): List<TokenInfo> {
        val tokenizer = sudachiDictionary.create()
        val morphemes = tokenizer.tokenize(SplitMode.B, text)

        return morphemes
            .mapNotNull { morpheme ->
                val pos = morpheme.partOfSpeech()
                if (pos.isEmpty()) return@mapNotNull null
                val partOfSpeech = PartOfSpeech.fromSudachiOrNull(pos[0]) ?: return@mapNotNull null
                TokenInfo(
                    surface = morpheme.surface(),
                    baseForm = morpheme.dictionaryForm(),
                    reading = morpheme.readingForm().ifEmpty { null },
                    partOfSpeech = partOfSpeech,
                    charStart = morpheme.begin(),
                    charEnd = morpheme.end()
                )
            }
    }
}
