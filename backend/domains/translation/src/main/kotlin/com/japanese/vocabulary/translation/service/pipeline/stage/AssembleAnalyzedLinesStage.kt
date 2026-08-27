package com.japanese.vocabulary.translation.service.pipeline.stage

import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.song.model.Token
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import com.japanese.vocabulary.translation.model.AssembleAnalyzedLinesInput
import com.japanese.vocabulary.translation.model.LexicalResolution
import com.japanese.vocabulary.translation.model.PipelineSenseOption
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
            // No line reading is stored: each token carries the reading sung in this line, and the
            // client assembles from those. See AnalyzedLine.
            AnalyzedLine(
                index = line.index,
                koreanLyrics = input.translationMap[line.index]?.koreanLyrics,
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
                    // The reading this line sings, not the table's: the table is keyed by headword, so
                    // a longer surface resolving through it lost morae (なんだ read ダ, だった read ダ).
                    // The table value is the fallback for a rewrite's token, which has no reading.
                    reading = readingFor(token.surface, rule.partOfSpeech, token.usedReading.ifBlank { rule.reading }),
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
            val partOfSpeech = option?.partOfSpeech ?: PartOfSpeech.OTHER
            val baseForm = option?.baseForm ?: resolvedBaseForm
            Token(
                surface = token.surface,
                baseForm = baseForm,
                // The inflected reading comes from segmentation and the dictionary reading from the
                // chosen entry, so 行って now keeps イッテ while its headword 行く reads イク. They used
                // to be the same jisho value, which made furigana show the dictionary form.
                reading = readingFor(
                    token.surface,
                    partOfSpeech,
                    dictionaryReading(token, option, baseForm) ?: token.usedReading.ifBlank { null },
                ),
                baseFormReading = option?.reading ?: token.baseFormReading.ifBlank { null },
                partOfSpeech = partOfSpeech,
                charStart = token.charStart,
                charEnd = token.charEnd,
                koreanText = if (option != null) koreanBySenseId[senseId] else null,
                jlpt = if (option != null) easiestJlpt(option.jlpt) else null,
            )
        }
    }

    /**
     * The dictionary's reading, when the surface *is* the dictionary form and so has no reading of its
     * own to keep. The model misreads a word the dictionary spells out on the same token
     * (痛々しい → イタタマシイ where jisho says イタイタシイ, 腹立たしい → ハラタタシイ for ハラダタシイ).
     *
     * Only for an unambiguous entry: with several entries in play the reading follows whichever entry
     * sense-select picked, and a wrong pick would then corrupt the reading too (前 as マエ or ゼン).
     * A lyric that glosses a word with a ruby reading loses it here — rare, and the model was already
     * answering the dictionary reading for those.
     */
    private fun dictionaryReading(token: PipelineToken, option: PipelineSenseOption?, baseForm: String): String? {
        if (option == null || token.surface != baseForm) return null
        if (option.provenance !in TRUSTED_READING_PROVENANCE) return null
        val reading = option.reading?.ifBlank { null } ?: return null
        // `はぁ` is stored ハァ and sung ハア: same reading, and the model's spelling of it converts better.
        return reading.takeUnless { JapaneseText.readingsAgree(it, token.usedReading) }
    }

    /**
     * [reading], with a particle's spelling corrected to what is sung. The model answers ワ for は only
     * about three times in four, so deciding it here makes the reading the same whatever the source.
     */
    private fun readingFor(surface: String, partOfSpeech: PartOfSpeech, reading: String?): String? =
        if (partOfSpeech == PartOfSpeech.PARTICLE) JapaneseText.particleReading(surface) ?: reading else reading

    /**
     * jisho jlpt is an entry-level array (e.g. ["jlpt-n1","jlpt-n5"]), not sense-scoped. Reduce to the
     * single EASIEST level (largest N = N5) — when the learner first meets the word. Mirrors `easiest_jlpt`.
     */
    private fun easiestJlpt(jlpt: List<String>): String? {
        val levels = jlpt.mapNotNull { it.substringAfterLast("-n", "").toIntOrNull() }
        return levels.maxOrNull()?.let { "N$it" }
    }

    private companion object {
        val TRUSTED_READING_PROVENANCE = setOf(
            JishoLookupProvenance.EXACT,
            JishoLookupProvenance.APPROVED_FALLBACK,
        )
    }
}
