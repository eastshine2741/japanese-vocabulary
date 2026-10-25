package com.japanese.vocabulary.translation.client.dictionary

import com.japanese.vocabulary.song.model.PartOfSpeech
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class DictionaryPartOfSpeechMapperTest {
    @Test
    fun `maps expressions label to expression POS`() {
        assertThat(DictionaryPartOfSpeechMapper.map(listOf("Expressions (phrases, clauses, etc.)")))
            .isEqualTo(PartOfSpeech.EXPRESSION)
    }

    @Test
    fun `keeps existing core mappings`() {
        assertThat(DictionaryPartOfSpeechMapper.map(listOf("Noun"))).isEqualTo(PartOfSpeech.NOUN)
        assertThat(DictionaryPartOfSpeechMapper.map(listOf("Godan verb"))).isEqualTo(PartOfSpeech.VERB)
        assertThat(DictionaryPartOfSpeechMapper.map(listOf("I-adjective"))).isEqualTo(PartOfSpeech.ADJECTIVE)
        assertThat(DictionaryPartOfSpeechMapper.map(listOf("Adverb"))).isEqualTo(PartOfSpeech.ADVERB)
        assertThat(DictionaryPartOfSpeechMapper.map(listOf("Particle"))).isEqualTo(PartOfSpeech.PARTICLE)
    }

    @Test
    fun `descriptive noun labels that embed other POS names stay nouns`() {
        // The literal string contains "particle"; 当たり前 / 最低 / 最初 / 隣 were all classified PARTICLE.
        assertThat(DictionaryPartOfSpeechMapper.map(listOf("Noun which may take the genitive case particle 'no'")))
            .isEqualTo(PartOfSpeech.NOUN)
        // Contains "verb".
        assertThat(DictionaryPartOfSpeechMapper.map(listOf("Noun or verb acting prenominally")))
            .isEqualTo(PartOfSpeech.NOUN)
        // Contains "particle", but the leading token decides.
        assertThat(DictionaryPartOfSpeechMapper.map(listOf("Adverb taking the 'to' particle")))
            .isEqualTo(PartOfSpeech.ADVERB)
    }

    @Test
    fun `usage markers yield to a real POS in the same sense`() {
        // 当たり前's actual label list.
        assertThat(
            DictionaryPartOfSpeechMapper.map(
                listOf(
                    "Noun which may take the genitive case particle 'no'",
                    "Na-adjective (keiyodoshi)",
                    "Noun",
                ),
            ),
        ).isEqualTo(PartOfSpeech.NA_ADJECTIVE)
    }

    @Test
    fun `usage marker alone still resolves to noun`() {
        // 日々's first sense carries nothing else.
        assertThat(DictionaryPartOfSpeechMapper.map(listOf("Noun which may take the genitive case particle 'no'")))
            .isEqualTo(PartOfSpeech.NOUN)
    }

    @Test
    fun `label order decides when several real POS labels are present`() {
        // The dictionary lists the primary word class first; do not re-rank it.
        assertThat(DictionaryPartOfSpeechMapper.map(listOf("Noun", "Adverb (fukushi)"))).isEqualTo(PartOfSpeech.NOUN)
        assertThat(DictionaryPartOfSpeechMapper.map(listOf("Adverb (fukushi)", "Noun"))).isEqualTo(PartOfSpeech.ADVERB)
        assertThat(DictionaryPartOfSpeechMapper.map(listOf("Noun", "Suru verb", "Transitive verb")))
            .isEqualTo(PartOfSpeech.NOUN)
    }

    @Test
    fun `maps the rest of the observed dictionary label inventory`() {
        mapOf(
            "Intransitive verb" to PartOfSpeech.VERB,
            "Godan verb with 'ru' ending (irregular verb)" to PartOfSpeech.VERB,
            "Kuru verb - special class" to PartOfSpeech.VERB,
            "Nidan verb (upper class) with 'gu' ending (archaic)" to PartOfSpeech.VERB,
            "Suru verb - included" to PartOfSpeech.VERB,
            "Na-adjective (keiyodoshi)" to PartOfSpeech.NA_ADJECTIVE,
            "I-Adjective (keiyoushi) - yoi/ii class" to PartOfSpeech.ADJECTIVE,
            "Auxiliary verb" to PartOfSpeech.AUXILIARY_VERB,
            "Auxiliary adjective" to PartOfSpeech.AUXILIARY_VERB,
            "Pre-noun adjectival (rentaishi)" to PartOfSpeech.ADNOMINAL,
            "Pronoun" to PartOfSpeech.PRONOUN,
            "Conjunction" to PartOfSpeech.CONJUNCTION,
            "Interjection (kandoushi)" to PartOfSpeech.INTERJECTION,
            "Prefix" to PartOfSpeech.PREFIX,
            "Suffix" to PartOfSpeech.SUFFIX,
            "Counter" to PartOfSpeech.SUFFIX,
            "Noun, used as a prefix" to PartOfSpeech.PREFIX,
            "Noun, used as a suffix" to PartOfSpeech.SUFFIX,
        ).forEach { (label, expected) ->
            assertThat(DictionaryPartOfSpeechMapper.map(listOf(label))).describedAs(label).isEqualTo(expected)
        }
    }

    @Test
    fun `unknown and empty input fall back to OTHER`() {
        assertThat(DictionaryPartOfSpeechMapper.map(emptyList())).isEqualTo(PartOfSpeech.OTHER)
        assertThat(DictionaryPartOfSpeechMapper.map(listOf("Place"))).isEqualTo(PartOfSpeech.OTHER)
    }
}
