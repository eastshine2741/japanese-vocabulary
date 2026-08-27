package com.japanese.vocabulary.translation.service.pipeline.stage

import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.translation.client.gemini.GeminiCallContext
import com.japanese.vocabulary.translation.client.gemini.dto.TranslationResultDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import com.japanese.vocabulary.translation.model.AssembleAnalyzedLinesInput
import com.japanese.vocabulary.translation.model.LexicalResolution
import com.japanese.vocabulary.translation.model.LexicalResolvedToken
import com.japanese.vocabulary.translation.model.PipelineSenseOption
import com.japanese.vocabulary.translation.model.PipelineToken
import com.japanese.vocabulary.translation.model.RuleResolvedToken
import com.japanese.vocabulary.translation.model.TranslationPipelineSource
import com.japanese.vocabulary.translation.model.WordPreparationResult
import kotlinx.coroutines.runBlocking
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class AssembleAnalyzedLinesStageTest {
    private val stage = AssembleAnalyzedLinesStage()

    @Test
    fun `anchors every token with the reading sung in this line so a client can assemble it`(): Unit = runBlocking {
        // 「行って」 yay — no line reading is stored, so what a client needs is on the tokens: the
        // reading, and the char range that says where it sits. The quotes, the space and the latin run
        // have no reading of their own, and a client falls back to their surface.
        val raw = "「行って」 yay"
        val tokens = listOf(
            token(raw, "「", "「", "「", "「"),
            token(raw, "行って", "行く", "イッテ", "イク"),
            token(raw, "」", "」", "」", "」"),
            token(raw, " ", " ", " ", " "),
            token(raw, "yay", "yay", "yay", "yay"),
        )

        val line = assemble(raw, tokens).single()

        assertThat(line.tokens.map { Triple(it.surface, it.reading, it.charStart to it.charEnd) })
            .containsExactly(
                Triple("「", null, 0 to 1),
                Triple("行って", "イッテ", 1 to 4),
                Triple("」", null, 4 to 5),
                Triple(" ", null, 5 to 6),
                Triple("yay", null, 6 to 9),
            )
    }

    @Test
    fun `keeps the inflected reading on the token and the dictionary reading on its base form`(): Unit = runBlocking {
        val raw = "行って"
        val option = senseOption(senseId = 0, baseForm = "行く", reading = "イク")
        val tokens = listOf(token(raw, "行って", "行く", "イッテ", "イク"))

        val line = assemble(
            raw,
            tokens,
            lexical = LexicalResolution(
                byTokenKey = mapOf(tokens[0].key to LexicalResolvedToken(tokens[0], "行く", listOf(option))),
                optionsById = mapOf(0 to option),
            ),
            selectedSenseByKey = mapOf(tokens[0].key to 0),
            koreanBySenseId = mapOf(0 to "가다"),
        ).single()

        val analyzed = line.tokens.single()
        assertThat(analyzed.reading).isEqualTo("イッテ")
        assertThat(analyzed.baseFormReading).isEqualTo("イク")
        assertThat(analyzed.baseForm).isEqualTo("行く")
        assertThat(analyzed.koreanText).isEqualTo("가다")
    }

    @Test
    fun `never carries hiragana into a token reading`(): Unit = runBlocking {
        val raw = "高く"
        val tokens = listOf(token(raw, "高く", "高い", "タカク", "タカイ"))

        val line = assemble(raw, tokens).single()

        val readings = line.tokens.flatMap { listOfNotNull(it.reading, it.baseFormReading) }
        assertThat(readings).isNotEmpty
        assertThat(readings).allSatisfy { assertThat(it).doesNotMatch(".*[\\u3041-\\u3096].*") }
    }

    @Test
    fun `produces a line with no tokens when nothing was segmented`(): Unit = runBlocking {
        val line = assemble("1, 2, 3", emptyList()).single()

        assertThat(line.tokens).isEmpty()
        assertThat(line.koreanLyrics).isEqualTo("번역")
    }

    @Test
    fun `takes rule-resolved meanings for grammar tokens, and reads a particle as it is sung`(): Unit = runBlocking {
        // The table transliterates its own surfaces, so it holds は as ハ. 猫は is sung ネコワ.
        val raw = "猫は"
        val tokens = listOf(
            token(raw, "猫", "猫", "ネコ", "ネコ"),
            token(raw, "は", "は", "ハ", "ハ"),
        )
        val rule = RuleResolvedToken("は", "は", "ハ", "ハ", PartOfSpeech.PARTICLE, "~은/는")

        val line = assemble(raw, tokens, ruleResolvedByKey = mapOf(tokens[1].key to rule)).single()

        assertThat(line.tokens.map { it.reading }).containsExactly("ネコ", "ワ")
        assertThat(line.tokens[1].partOfSpeech).isEqualTo(PartOfSpeech.PARTICLE)
        assertThat(line.tokens[1].koreanText).isEqualTo("~은/는")
    }

    @Test
    fun `keeps the sung reading of a surface the rule table only knows by its headword`(): Unit = runBlocking {
        // なんだ resolves through だ and used to take だ's reading: 바카다 instead of 바카닷타.
        val raw = "馬鹿なんだ"
        val tokens = listOf(
            token(raw, "馬鹿", "馬鹿", "バカ", "バカ"),
            token(raw, "なんだ", "だ", "ナンダ", "ダ"),
        )
        val rule = RuleResolvedToken("だ", "だ", "ダ", "ダ", PartOfSpeech.AUXILIARY_VERB, "~이다")

        val line = assemble(raw, tokens, ruleResolvedByKey = mapOf(tokens[1].key to rule)).single()

        assertThat(line.tokens.map { it.reading }).containsExactly("バカ", "ナンダ")
        assertThat(line.tokens[1].baseFormReading).isEqualTo("ダ")
    }

    @Test
    fun `falls back to the rule table when the token carries no reading of its own`(): Unit = runBlocking {
        // A rewrite's token (どうも → どう + も) has no segmentation reading behind it.
        val raw = "どうも"
        val tokens = listOf(token(raw, "も", "も", "", ""))
        val rule = RuleResolvedToken("も", "も", "モ", "モ", PartOfSpeech.PARTICLE, "~도")

        val line = assemble(raw, tokens, ruleResolvedByKey = mapOf(tokens[0].key to rule)).single()

        assertThat(line.tokens.single().reading).isEqualTo("モ")
    }

    @Test
    fun `reads every は in a compound particle as it is sung`(): Unit = runBlocking {
        // までは is one token the model splits itself, and it kept the spelling: マデハ.
        val raw = "夏までは"
        val tokens = listOf(
            token(raw, "夏", "夏", "ナツ", "ナツ"),
            token(raw, "までは", "まで", "マデハ", "マデ"),
        )
        val rule = RuleResolvedToken("まで", "まで", "マデ", "マデ", PartOfSpeech.PARTICLE, "~까지")

        val line = assemble(raw, tokens, ruleResolvedByKey = mapOf(tokens[1].key to rule)).single()

        assertThat(line.tokens.map { it.reading }).containsExactly("ナツ", "マデワ")
    }


    private suspend fun assemble(
        raw: String,
        tokens: List<PipelineToken>,
        ruleResolvedByKey: Map<com.japanese.vocabulary.translation.model.PipelineTokenKey, RuleResolvedToken> = emptyMap(),
        lexical: LexicalResolution = LexicalResolution(emptyMap(), emptyMap()),
        selectedSenseByKey: Map<com.japanese.vocabulary.translation.model.PipelineTokenKey, Int> = emptyMap(),
        koreanBySenseId: Map<Int, String> = emptyMap(),
    ) = stage.execute(
        AssembleAnalyzedLinesInput(
            source = TranslationPipelineSource.from(
                listOf(LyricLineData(index = 0, startTimeMs = null, text = raw)),
                GeminiCallContext(songId = 1L, lyricId = 1L),
            ),
            translationMap = mapOf(0 to TranslationResultDto(index = 0, koreanLyrics = "번역")),
            wordPreparation = WordPreparationResult(
                segLines = emptyList(),
                tokensByIndex = mapOf(0 to tokens),
                ruleResolvedByKey = ruleResolvedByKey,
                lexical = lexical,
            ),
            selectedSenseByKey = selectedSenseByKey,
            koreanBySenseId = koreanBySenseId,
        ),
    )

    /** Anchors [surface] at its position in [raw], the way the segmentation validator would. */
    private fun token(
        raw: String,
        surface: String,
        headword: String,
        usedReading: String,
        baseFormReading: String,
    ): PipelineToken {
        val start = raw.indexOf(surface)
        return PipelineToken(
            lineIndex = 0,
            surface = surface,
            headword = headword,
            charStart = start,
            charEnd = start + surface.length,
            usedReading = usedReading,
            baseFormReading = baseFormReading,
            contextGloss = "gloss",
        )
    }

    private fun senseOption(senseId: Int, baseForm: String, reading: String) = PipelineSenseOption(
        senseId = senseId,
        baseForm = baseForm,
        headword = baseForm,
        reading = reading,
        partOfSpeech = PartOfSpeech.VERB,
        rawPos = listOf("Godan verb"),
        english = "to go",
        englishDefinitions = listOf("to go"),
        jlpt = listOf("jlpt-n5"),
        provenance = JishoLookupProvenance.EXACT,
    )
}
