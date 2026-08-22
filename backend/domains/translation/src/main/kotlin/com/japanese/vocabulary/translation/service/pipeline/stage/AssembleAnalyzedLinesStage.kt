package com.japanese.vocabulary.translation.service.pipeline.stage

import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.song.model.Token
import com.japanese.vocabulary.translation.model.AssembleAnalyzedLinesInput
import com.japanese.vocabulary.translation.model.LexicalResolution
import com.japanese.vocabulary.translation.model.PipelineToken
import com.japanese.vocabulary.translation.model.PipelineTokenKey
import com.japanese.vocabulary.translation.model.RuleResolvedToken
import com.japanese.vocabulary.translation.service.pipeline.JapaneseText
import org.springframework.stereotype.Component

@Component
class AssembleAnalyzedLinesStage : PipelineStage<AssembleAnalyzedLinesInput, List<AnalyzedLine>> {

    override suspend fun execute(input: AssembleAnalyzedLinesInput): List<AnalyzedLine> {
        val wordPreparation = input.wordPreparation
        return input.source.lyricLines.map { line ->
            val tokens = wordPreparation.tokensByIndex[line.index] ?: emptyList()
            // koreanPronounciation is left at its null default: the pronunciation this pipeline
            // produces is katakana, and the app derives the Hangul reading from it.
            AnalyzedLine(
                index = line.index,
                koreanLyrics = input.translationMap[line.index]?.koreanLyrics,
                pronounciation = buildPronounciation(line.text, tokens),
                tokens = buildTokens(
                    tokens = tokens,
                    ruleResolvedByKey = wordPreparation.ruleResolvedByKey,
                    lexical = wordPreparation.lexical,
                    selectedSenseByKey = input.selectedSenseByKey,
                    koreanBySenseId = input.koreanBySenseId,
                ),
            )
        }
    }

    /**
     * The line's reading: each token's katakana reading in position order, with the raw text of any
     * gap between tokens copied verbatim.
     *
     * The gaps are what keep the line legible — spaces, punctuation, and latin runs sit between tokens
     * and have no reading of their own, so reproducing them preserves the line's shape instead of
     * fusing every word together. A line with no tokens has nothing to transcribe, so its raw text
     * stands in.
     */
    private fun buildPronounciation(rawText: String, tokens: List<PipelineToken>): String {
        if (tokens.isEmpty()) return rawText
        val builder = StringBuilder()
        var cursor = 0
        tokens.sortedBy { it.charStart }.forEach { token ->
            if (token.charStart > cursor) {
                builder.append(rawText, cursor, token.charStart)
            }
            builder.append(token.usedReading.ifBlank { token.surface })
            cursor = maxOf(cursor, token.charEnd)
        }
        if (cursor < rawText.length) {
            builder.append(rawText, cursor, rawText.length)
        }
        return builder.toString()
    }

    private fun buildTokens(
        tokens: List<PipelineToken>,
        ruleResolvedByKey: Map<PipelineTokenKey, RuleResolvedToken>,
        lexical: LexicalResolution,
        selectedSenseByKey: Map<PipelineTokenKey, Int>,
        koreanBySenseId: Map<Int, String>,
    ): List<Token> {
        return tokens.map { token ->
            if (!JapaneseText.containsJapanese(token.surface)) {
                return@map Token(
                    surface = token.surface,
                    baseForm = token.headword,
                    reading = null,
                    baseFormReading = null,
                    partOfSpeech = PartOfSpeech.SYMBOL,
                    charStart = token.charStart,
                    charEnd = token.charEnd,
                    koreanText = null,
                    jlpt = null,
                )
            }

            val rule = ruleResolvedByKey[token.key]
            if (rule != null) {
                return@map Token(
                    surface = token.surface,
                    baseForm = rule.baseForm,
                    reading = rule.reading,
                    baseFormReading = rule.baseFormReading,
                    partOfSpeech = rule.partOfSpeech,
                    charStart = token.charStart,
                    charEnd = token.charEnd,
                    koreanText = rule.koreanText,
                    jlpt = rule.jlpt,
                )
            }

            val senseId = selectedSenseByKey[token.key] ?: -1
            val option = if (senseId >= 0) lexical.optionsById[senseId] else null
            val resolvedBaseForm = lexical.byTokenKey[token.key]?.baseForm ?: token.headword
            Token(
                surface = token.surface,
                baseForm = option?.baseForm ?: resolvedBaseForm,
                // The inflected reading comes from segmentation and the dictionary reading from the
                // chosen entry, so 行って now keeps イッテ while its headword 行く reads イク. They used
                // to be the same jisho value, which made furigana show the dictionary form.
                reading = token.usedReading.ifBlank { null },
                baseFormReading = option?.reading ?: token.baseFormReading.ifBlank { null },
                partOfSpeech = option?.partOfSpeech ?: PartOfSpeech.OTHER,
                charStart = token.charStart,
                charEnd = token.charEnd,
                koreanText = if (option != null) koreanBySenseId[senseId] else null,
                jlpt = if (option != null) easiestJlpt(option.jlpt) else null,
            )
        }
    }

    /**
     * jisho jlpt is an entry-level array (e.g. ["jlpt-n1","jlpt-n5"]), not sense-scoped. Reduce to the
     * single EASIEST level (largest N = N5) — when the learner first meets the word. Mirrors `easiest_jlpt`.
     */
    private fun easiestJlpt(jlpt: List<String>): String? {
        val levels = jlpt.mapNotNull { it.substringAfterLast("-n", "").toIntOrNull() }
        return levels.maxOrNull()?.let { "N$it" }
    }
}
