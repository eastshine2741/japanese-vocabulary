package com.japanese.vocabulary.translation.service.pipeline

import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.translation.model.PipelineToken
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class RuleMeaningProviderTest {
    private val provider = RuleMeaningProvider()

    @Test
    fun `resolves teiru and teru as auxiliary ongoing action`() {
        assertThat(provider.resolve(token("ている"))!!.partOfSpeech).isEqualTo(PartOfSpeech.AUXILIARY_VERB)
        assertThat(provider.resolve(token("てる"))!!.koreanText).isEqualTo("~하고 있다")
    }

    @Test
    fun `resolves particles`() {
        val resolved = provider.resolve(token("も"))!!

        assertThat(resolved.partOfSpeech).isEqualTo(PartOfSpeech.PARTICLE)
        assertThat(resolved.koreanText).isEqualTo("~도")
    }

    @Test
    fun `does not rule-resolve ambiguous grammar-like words`() {
        assertThat(provider.resolve(token("ない"))).isNull()
        assertThat(provider.resolve(token("から"))).isNull()
    }

    @Test
    fun `resolves doushite and ikagashite spelling as why`() {
        val resolved = provider.resolve(token("如何して"))!!

        assertThat(resolved.baseForm).isEqualTo("どうして")
        assertThat(resolved.partOfSpeech).isEqualTo(PartOfSpeech.ADVERB)
        assertThat(resolved.koreanText).contains("왜")
    }

    @Test
    fun `rewrites doumo koumo pair into deterministic smaller tokens`() {
        val rewritten = provider.rewrite(
            listOf(
                PipelineToken(0, "どうも", "どうも", 0, 3),
                PipelineToken(0, "こうも", "こうも", 3, 6),
            ),
        )

        assertThat(rewritten.map { it.surface }).containsExactly("どう", "も", "こう", "も")
        assertThat(rewritten.map { it.charStart to it.charEnd }).containsExactly(0 to 2, 2 to 3, 3 to 5, 5 to 6)
    }

    @Test
    fun `rewrites locative made phrases into location and particle`() {
        val rewritten = provider.rewrite(
            listOf(
                PipelineToken(0, "ここまで", "ここまで", 0, 4),
                PipelineToken(0, "そこまで", "そこまで", 4, 8),
                PipelineToken(0, "あそこまで", "あそこまで", 8, 13),
                PipelineToken(0, "どこまで", "どこまで", 13, 17),
            ),
        )

        assertThat(rewritten.map { it.surface }).containsExactly(
            "ここ",
            "まで",
            "そこ",
            "まで",
            "あそこ",
            "まで",
            "どこ",
            "まで",
        )
        assertThat(rewritten.map { it.dictionaryForm }).containsExactly(
            "ここ",
            "まで",
            "そこ",
            "まで",
            "あそこ",
            "まで",
            "どこ",
            "まで",
        )
        assertThat(rewritten.map { it.charStart to it.charEnd }).containsExactly(
            0 to 2,
            2 to 4,
            4 to 6,
            6 to 8,
            8 to 11,
            11 to 13,
            13 to 15,
            15 to 17,
        )
    }

    private fun token(surface: String) = PipelineToken(0, surface, surface, 0, surface.length)
}
