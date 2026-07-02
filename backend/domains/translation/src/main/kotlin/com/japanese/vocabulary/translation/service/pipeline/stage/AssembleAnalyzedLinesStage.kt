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
            AnalyzedLine(
                index = line.index,
                koreanLyrics = input.translationMap[line.index]?.koreanLyrics,
                koreanPronounciation = input.translationMap[line.index]?.koreanPronounciation,
                tokens = buildTokens(
                    tokens = wordPreparation.tokensByIndex[line.index] ?: emptyList(),
                    ruleResolvedByKey = wordPreparation.ruleResolvedByKey,
                    lexical = wordPreparation.lexical,
                    selectedSenseByKey = input.selectedSenseByKey,
                    koreanBySenseId = input.koreanBySenseId,
                ),
            )
        }
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
                    baseForm = token.dictionaryForm,
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
            val resolvedBaseForm = lexical.byTokenKey[token.key]?.baseForm ?: token.dictionaryForm
            Token(
                surface = token.surface,
                baseForm = option?.baseForm ?: resolvedBaseForm,
                reading = option?.reading,
                baseFormReading = option?.reading,
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
