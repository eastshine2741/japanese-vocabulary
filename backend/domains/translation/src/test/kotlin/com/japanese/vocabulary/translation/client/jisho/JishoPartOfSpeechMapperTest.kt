package com.japanese.vocabulary.translation.client.jisho

import com.japanese.vocabulary.song.model.PartOfSpeech
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class JishoPartOfSpeechMapperTest {
    @Test
    fun `maps expressions label to expression POS`() {
        assertThat(JishoPartOfSpeechMapper.map(listOf("Expressions (phrases, clauses, etc.)")))
            .isEqualTo(PartOfSpeech.EXPRESSION)
    }

    @Test
    fun `keeps existing core mappings`() {
        assertThat(JishoPartOfSpeechMapper.map(listOf("Noun"))).isEqualTo(PartOfSpeech.NOUN)
        assertThat(JishoPartOfSpeechMapper.map(listOf("Godan verb"))).isEqualTo(PartOfSpeech.VERB)
        assertThat(JishoPartOfSpeechMapper.map(listOf("I-adjective"))).isEqualTo(PartOfSpeech.ADJECTIVE)
        assertThat(JishoPartOfSpeechMapper.map(listOf("Adverb"))).isEqualTo(PartOfSpeech.ADVERB)
        assertThat(JishoPartOfSpeechMapper.map(listOf("Particle"))).isEqualTo(PartOfSpeech.PARTICLE)
    }
}
