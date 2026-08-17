package com.japanese.vocabulary.translation.client.jisho

import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryRawDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoJapaneseDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import com.japanese.vocabulary.translation.client.jisho.dto.JishoSearchResponse
import com.japanese.vocabulary.translation.client.jisho.dto.JishoSenseDto
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.web.client.RestClient

/**
 * Covers [JishoClient.distill] / flattening only — no network. The client is constructed with a plain
 * builder because distillation never touches the RestClient.
 */
class JishoClientDistillTest {
    private val client = JishoClient(RestClient.builder())

    @Test
    fun `reading and headword come from the japanese element matching the query`() {
        // Real shape of jisho's 言 entry: it owns both 言[げん] and 言[こと].
        val response = JishoSearchResponse(
            data = listOf(
                JishoEntryRawDto(
                    japanese = listOf(
                        JishoJapaneseDto(word = "言", reading = "げん"),
                        JishoJapaneseDto(word = "言", reading = "こと"),
                    ),
                    senses = listOf(JishoSenseDto(englishDefinitions = listOf("word", "remark"), partsOfSpeech = listOf("Noun"))),
                ),
            ),
        )

        val option = client.distill("こと", response).options.single()

        assertThat(option.reading).isEqualTo("こと")
        assertThat(option.headword).isEqualTo("言")
    }

    @Test
    fun `a kana query matching a later element does not inherit the first element's reading`() {
        // 岳 owns 岳[たけ] and 岳[だけ]; querying だけ must not report たけ.
        val response = JishoSearchResponse(
            data = listOf(
                JishoEntryRawDto(
                    japanese = listOf(
                        JishoJapaneseDto(word = "岳", reading = "たけ"),
                        JishoJapaneseDto(word = "岳", reading = "だけ"),
                    ),
                    senses = listOf(JishoSenseDto(englishDefinitions = listOf("(high) mountain"), partsOfSpeech = listOf("Noun"))),
                ),
            ),
        )

        assertThat(client.distill("だけ", response).options.single().reading).isEqualTo("だけ")
    }

    @Test
    fun `homograph entries keep their own reading and jlpt`() {
        // 前 flattens 前[ぜん] (N1) and 前[まえ] (N5) into one option list.
        val response = JishoSearchResponse(
            data = listOf(
                JishoEntryRawDto(
                    japanese = listOf(JishoJapaneseDto(word = "前", reading = "ぜん")),
                    senses = listOf(JishoSenseDto(englishDefinitions = listOf("before"), partsOfSpeech = listOf("Noun, used as a prefix"))),
                    jlpt = listOf("jlpt-n1"),
                ),
                JishoEntryRawDto(
                    japanese = listOf(JishoJapaneseDto(word = "前", reading = "まえ")),
                    senses = listOf(JishoSenseDto(englishDefinitions = listOf("before", "earlier"), partsOfSpeech = listOf("Noun"))),
                    jlpt = listOf("jlpt-n5"),
                ),
            ),
        )

        val options = client.distill("前", response).options

        assertThat(options).hasSize(2)
        assertThat(options.map { it.reading }).containsExactly("ぜん", "まえ")
        assertThat(options.map { it.jlpt }).containsExactly(listOf("jlpt-n1"), listOf("jlpt-n5"))
    }

    @Test
    fun `kana-only entries have no headword`() {
        val response = JishoSearchResponse(
            data = listOf(
                JishoEntryRawDto(
                    japanese = listOf(JishoJapaneseDto(reading = "メッセージ")),
                    senses = listOf(JishoSenseDto(englishDefinitions = listOf("message"), partsOfSpeech = listOf("Noun"))),
                ),
            ),
        )

        val option = client.distill("メッセージ", response).options.single()

        assertThat(option.headword).isNull()
        assertThat(option.reading).isEqualTo("メッセージ")
    }

    @Test
    fun `a non-matching top entry is retained as rejected fallback with its own first form`() {
        val response = JishoSearchResponse(
            data = listOf(
                JishoEntryRawDto(
                    japanese = listOf(JishoJapaneseDto(word = "全然", reading = "ぜんぜん")),
                    senses = listOf(JishoSenseDto(englishDefinitions = listOf("not at all"), partsOfSpeech = listOf("Adverb (fukushi)"))),
                ),
            ),
        )

        val entry = client.distill("ぜんぶ", response)

        assertThat(entry.found).isFalse()
        assertThat(entry.provenance).isEqualTo(JishoLookupProvenance.REJECTED_FALLBACK)
        assertThat(entry.options.single().reading).isEqualTo("ぜんぜん")
    }
}
