package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.song.dto.TokenInfo
import org.apache.lucene.analysis.ja.JapaneseTokenizer
import org.apache.lucene.analysis.ja.tokenattributes.BaseFormAttribute
import org.apache.lucene.analysis.ja.tokenattributes.PartOfSpeechAttribute
import org.apache.lucene.analysis.ja.tokenattributes.ReadingAttribute
import org.apache.lucene.analysis.tokenattributes.CharTermAttribute
import org.apache.lucene.analysis.tokenattributes.OffsetAttribute
import org.springframework.stereotype.Service
import java.io.StringReader

@Service
class MorphologicalAnalyzer {

    private val includedPosTypes = setOf("名詞", "動詞", "形容詞", "形容動詞")

    fun analyze(text: String): List<TokenInfo> {
        val tokens = mutableListOf<TokenInfo>()

        JapaneseTokenizer(null, true, JapaneseTokenizer.Mode.SEARCH).use { tokenizer ->
            tokenizer.setReader(StringReader(text))

            val termAttr = tokenizer.addAttribute(CharTermAttribute::class.java)
            val offsetAttr = tokenizer.addAttribute(OffsetAttribute::class.java)
            val posAttr = tokenizer.addAttribute(PartOfSpeechAttribute::class.java)
            val baseFormAttr = tokenizer.addAttribute(BaseFormAttribute::class.java)
            val readingAttr = tokenizer.addAttribute(ReadingAttribute::class.java)

            tokenizer.reset()

            while (tokenizer.incrementToken()) {
                val primaryPos = posAttr.partOfSpeech?.split("-")?.firstOrNull() ?: ""
                if (primaryPos !in includedPosTypes) continue

                val surface = termAttr.toString()
                tokens.add(
                    TokenInfo(
                        surface = surface,
                        baseForm = baseFormAttr.baseForm ?: surface,
                        reading = readingAttr.reading,
                        partOfSpeech = primaryPos,
                        charStart = offsetAttr.startOffset(),
                        charEnd = offsetAttr.endOffset()
                    )
                )
            }

            tokenizer.end()
        }

        return tokens
    }
}
