package com.japanese.vocabulary.song.worker

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.song.service.SongAnalysisPreparationService.PreparedLyric
import com.japanese.vocabulary.translation.client.gemini.dto.SegLineDto
import com.japanese.vocabulary.translation.client.gemini.dto.SegWordDto
import com.japanese.vocabulary.translation.client.gemini.dto.TranslationResultDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import com.japanese.vocabulary.translation.model.LexicalResolution
import com.japanese.vocabulary.translation.model.LexicalResolvedToken
import com.japanese.vocabulary.translation.model.PipelineSenseOption
import com.japanese.vocabulary.translation.model.PipelineToken
import com.japanese.vocabulary.translation.model.RuleResolvedToken
import com.japanese.vocabulary.translation.model.SegmentationStageResult
import com.japanese.vocabulary.translation.model.WordPreparationResult
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

/**
 * 단계 산출물은 다음 단계가 되읽어야 쓸모가 있다. 하나라도 값이 바뀌어 돌아오면, 실패한 단계부터
 * 이어 돌린 결과가 한 번에 돌린 결과와 달라진다.
 */
class SongAnalysisStageCodecTest {

    private val codec = SongAnalysisStageCodec(ObjectMapper().registerKotlinModule())

    @Test
    fun `analyze output round-trips, token keys included`() {
        // surface 에 콜론이 있어도 키가 깨지지 않아야 한다.
        val token = PipelineToken(
            lineIndex = 3,
            surface = "恋:愛",
            headword = "恋愛",
            charStart = 2,
            charEnd = 5,
            usedReading = "レンアイ",
            baseFormReading = "レンアイ",
            contextGloss = "romance",
        )
        val option = PipelineSenseOption(
            senseId = 11,
            baseForm = "恋愛",
            headword = "恋愛",
            reading = "レンアイ",
            partOfSpeech = PartOfSpeech.NOUN,
            rawPos = listOf("Noun", "Suru verb"),
            english = "love",
            englishDefinitions = listOf("love", "romance"),
            jlpt = listOf("jlpt-n3"),
            provenance = JishoLookupProvenance.EXACT,
        )
        val segLines = listOf(SegLineDto(3, listOf(SegWordDto("恋:愛", "恋愛", "レンアイ", "レンアイ", "romance"))))
        val tokensByIndex = mapOf(3 to listOf(token))
        val output = AnalyzeLyricsOutput(
            translation = mapOf(3 to TranslationResultDto(3, "연애")),
            segmentation = SegmentationStageResult(segLines, tokensByIndex),
            words = WordPreparationResult(
                segLines = segLines,
                tokensByIndex = tokensByIndex,
                ruleResolvedByKey = mapOf(
                    token.key to RuleResolvedToken("恋:愛", "恋愛", "レンアイ", "レンアイ", PartOfSpeech.NOUN, "연애", "N3"),
                ),
                lexical = LexicalResolution(
                    byTokenKey = mapOf(token.key to LexicalResolvedToken(token, "恋愛", listOf(option))),
                    optionsById = mapOf(11 to option),
                ),
            ),
        )

        val restored = codec.read(codec.write(output), AnalyzeLyricsOutput::class.java)

        assertThat(restored).isEqualTo(output)
    }

    @Test
    fun `partial analyze output keeps the missing branch empty`() {
        val partial = AnalyzeLyricsOutput(translation = mapOf(0 to TranslationResultDto(0, "고양이")))

        assertThat(codec.read(codec.write(partial), AnalyzeLyricsOutput::class.java)).isEqualTo(partial)
    }

    @Test
    fun `other stage outputs round-trip`() {
        val token = PipelineToken(lineIndex = 0, surface = "猫", headword = "猫", charStart = 0, charEnd = 1)
        val prepared = PreparedLyric(LyricType.SYNCED, listOf(LyricLineData(0, 1200L, "猫")), lrclibId = 7, vocadbId = null)

        assertThat(codec.read(codec.write(prepared), PreparedLyric::class.java)).isEqualTo(prepared)
        assertThat(codec.read(codec.write(SelectSensesOutput(mapOf(token.key to 4))), SelectSensesOutput::class.java))
            .isEqualTo(SelectSensesOutput(mapOf(token.key to 4)))
        assertThat(codec.read(codec.write(TranslateSensesOutput(mapOf(4 to "고양이"))), TranslateSensesOutput::class.java))
            .isEqualTo(TranslateSensesOutput(mapOf(4 to "고양이")))
    }
}
