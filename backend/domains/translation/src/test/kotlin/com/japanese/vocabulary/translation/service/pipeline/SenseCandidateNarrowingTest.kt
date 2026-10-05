package com.japanese.vocabulary.translation.service.pipeline

import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import com.japanese.vocabulary.translation.model.PipelineSenseOption
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class SenseCandidateNarrowingTest {

    @Test
    fun `a function-word gloss drops content-word homophones`() {
        // て glossed as a connective: 手 "hand" is a homophone, not a candidate.
        val options = listOf(
            option(1, "hand / arm", "Noun", headword = "手"),
            option(2, "and", "Particle", "Conjunction"),
            option(3, "please (do)", "Particle"),
        )

        val narrowed = SenseCandidateNarrowing.narrow("connective", options)

        assertThat(narrowed.map { it.senseId }).containsExactly(2, 3)
    }

    @Test
    fun `a counter suffix keeps the counter sense`() {
        // ラット1つ: つ glossed "counter suffix" is jisho's Counter, which the suffix hint must keep.
        val options = listOf(option(1, "general-purpose counter", "Counter"), option(2, "harbour", "Noun"))

        val narrowed = SenseCandidateNarrowing.narrow("counter suffix", options)

        assertThat(narrowed.map { it.senseId }).containsExactly(1)
    }

    @Test
    fun `a hint that matches no candidate POS leaves the candidates alone`() {
        val options = listOf(option(1, "hand", "Noun"), option(2, "handle", "Noun"))

        val narrowed = SenseCandidateNarrowing.narrow("particle", options)

        assertThat(narrowed).isEqualTo(options)
    }

    @Test
    fun `a content-word gloss narrows nothing by POS`() {
        val options = listOf(option(1, "to become", "Godan verb"), option(2, "to ring", "Godan verb"), option(3, "Naru", "Place"))

        val narrowed = SenseCandidateNarrowing.narrow("become", options)

        assertThat(narrowed).isEqualTo(options)
    }

    @Test
    fun `variant spellings repeating the same gloss collapse to the first`() {
        // これ: 此れ and 是 are separate entries with identical senses.
        val options = listOf(
            option(1, "this", "Pronoun", headword = "此れ"),
            option(2, "this", "Pronoun", headword = "是"),
            option(3, "now", "Adverb", headword = "此れ"),
        )

        val narrowed = SenseCandidateNarrowing.narrow("this", options)

        assertThat(narrowed.map { it.senseId }).containsExactly(1, 3)
    }

    private fun option(senseId: Int, english: String, vararg pos: String, headword: String? = null) = PipelineSenseOption(
        senseId = senseId,
        baseForm = "w",
        headword = headword,
        reading = "テ",
        partOfSpeech = PartOfSpeech.NOUN,
        rawPos = pos.toList(),
        english = english,
        englishDefinitions = listOf(english),
        jlpt = emptyList(),
        provenance = JishoLookupProvenance.AMBIGUOUS_HEADWORD,
    )
}
