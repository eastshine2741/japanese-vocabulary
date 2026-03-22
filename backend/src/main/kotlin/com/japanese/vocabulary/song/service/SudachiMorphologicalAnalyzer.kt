package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.song.dto.PartOfSpeech
import com.japanese.vocabulary.song.dto.TokenInfo
import com.worksap.nlp.sudachi.Dictionary
import com.worksap.nlp.sudachi.Tokenizer.SplitMode
import org.springframework.stereotype.Component

@Component
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
                val surface = morpheme.surface()
                val baseForm = morpheme.dictionaryForm()
                val reading = morpheme.readingForm().ifEmpty { null }
                val baseFormReading = if (surface == baseForm) {
                    reading
                } else {
                    tokenizer.tokenize(SplitMode.B, baseForm)
                        .mapNotNull { it.readingForm().ifEmpty { null } }
                        .joinToString("")
                        .ifEmpty { null }
                }
                TokenInfo(
                    surface = surface,
                    baseForm = baseForm,
                    reading = reading,
                    baseFormReading = baseFormReading,
                    partOfSpeech = partOfSpeech,
                    charStart = morpheme.begin(),
                    charEnd = morpheme.end()
                )
            }
    }
}
