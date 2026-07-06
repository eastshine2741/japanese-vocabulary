package com.japanese.vocabulary.translation.service.pipeline

import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import com.japanese.vocabulary.translation.client.jisho.dto.JishoOptionDto
import com.japanese.vocabulary.translation.model.PipelineSenseOption
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class SenseTranslationPreparerTest {
    private val preparer = SenseTranslationPreparer()

    @Test
    fun `builds translate input with lexical identity and english definition list`() {
        val input = preparer.buildInput(
            listOf(7),
            mapOf(
                7 to PipelineSenseOption(
                    senseId = 7,
                    surface = "真っ逆様",
                    baseForm = "真っ逆様",
                    reading = "まっさかさま",
                    partOfSpeech = PartOfSpeech.NOUN,
                    rawPos = listOf("Noun"),
                    english = "head over heels / headlong / head first",
                    englishDefinitions = listOf("head over heels", "headlong", "head first"),
                    jlpt = emptyList(),
                    provenance = JishoLookupProvenance.EXACT,
                    option = JishoOptionDto(),
                ),
            ),
        )

        assertThat(input).hasSize(1)
        val item = input.single()
        assertThat(item["senseId"]).isEqualTo(7)
        assertThat(item["surface"]).isEqualTo("真っ逆様")
        assertThat(item["baseForm"]).isEqualTo("真っ逆様")
        assertThat(item["reading"]).isEqualTo("まっさかさま")
        assertThat(item["pos"]).isEqualTo("NOUN")
        assertThat(item["englishDefinitions"]).isEqualTo(listOf("head over heels", "headlong", "head first"))
    }
}
