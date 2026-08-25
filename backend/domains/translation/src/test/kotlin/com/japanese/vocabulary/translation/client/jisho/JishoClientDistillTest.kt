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
 * Covers [JishoClient.distill] / entry expansion only — no network. The client is constructed with a
 * plain builder because distillation never touches the RestClient.
 */
class JishoClientDistillTest {
    private val client = JishoClient(RestClient.builder())

    @Test
    fun `each spelling-reading pair of an entry becomes its own dictionary entry`() {
        // Real shape of jisho's 言 entry: it owns both 言[げん] and 言[こと], sharing the senses.
        val response = JishoSearchResponse(
            data = listOf(
                JishoEntryRawDto(
                    japanese = listOf(
                        JishoJapaneseDto(word = "言", reading = "げん"),
                        JishoJapaneseDto(word = "言", reading = "こと"),
                    ),
                    senses = listOf(
                        JishoSenseDto(englishDefinitions = listOf("word", "remark"), partsOfSpeech = listOf("Noun")),
                    ),
                ),
            ),
        )

        val entries = client.distill("こと", response).entries

        assertThat(entries.map { it.headword }).containsExactly("言", "言")
        assertThat(entries.map { it.reading }).containsExactly("ゲン", "コト")
        assertThat(entries.map { it.senses.single().english }).containsExactly("word / remark", "word / remark")
    }

    @Test
    fun `homograph entries stay separate and keep their own jlpt`() {
        // This is the bug the redesign fixes: 前[ぜん] and 前[まえ] used to arrive as one flat list of
        // senses with no boundary, so nothing downstream could tell which meaning was whose.
        val entries = client.distill("前", maeAndZen()).entries

        assertThat(entries).hasSize(2)
        val zen = entries.single { it.reading == "ゼン" }
        val mae = entries.single { it.reading == "マエ" }
        assertThat(zen.jlpt).containsExactly("jlpt-n1")
        assertThat(mae.jlpt).containsExactly("jlpt-n5")
        assertThat(zen.senses.map { it.english }).containsExactly("before")
        assertThat(mae.senses.map { it.english }).containsExactly("before / earlier")
    }

    @Test
    fun `an alternate spelling on another entry does not merge into the queried word`() {
        // jisho's 先 entry lists 前 as an alternate spelling, which is how 先[さき]'s meanings used to
        // leak into a lookup for 前. They must remain a separately addressable entry.
        val response = JishoSearchResponse(
            data = maeAndZen().data + JishoEntryRawDto(
                japanese = listOf(
                    JishoJapaneseDto(word = "先", reading = "さき"),
                    JishoJapaneseDto(word = "前", reading = "さき"),
                ),
                senses = listOf(
                    JishoSenseDto(englishDefinitions = listOf("previous"), partsOfSpeech = listOf("Noun")),
                ),
                jlpt = listOf("jlpt-n5"),
            ),
        )

        val entries = client.distill("前", response).entries

        assertThat(entries.map { it.headword to it.reading }).containsExactly(
            "前" to "ゼン",
            "前" to "マエ",
            "先" to "サキ",
            "前" to "サキ",
        )
        // The pair (前, マエ) picks exactly one entry, and 先[サキ]'s sense is not in it.
        val mae = entries.single { it.headword == "前" && it.reading == "マエ" }
        assertThat(mae.senses.map { it.english }).containsExactly("before / earlier")
    }

    @Test
    fun `hiragana readings from jisho are stored as katakana`() {
        // jisho always answers in hiragana; the pipeline stores readings in katakana so the app can
        // convert for display without guessing the script.
        val entries = client.distill("前", maeAndZen()).entries

        assertThat(entries.map { it.reading }).allSatisfy { assertThat(it).matches("[ァ-ヺー]+") }
    }

    @Test
    fun `kana-only entries have no headword`() {
        val response = JishoSearchResponse(
            data = listOf(
                JishoEntryRawDto(
                    japanese = listOf(JishoJapaneseDto(reading = "メッセージ")),
                    senses = listOf(
                        JishoSenseDto(englishDefinitions = listOf("message"), partsOfSpeech = listOf("Noun")),
                    ),
                ),
            ),
        )

        val entry = client.distill("メッセージ", response).entries.single()

        assertThat(entry.headword).isNull()
        assertThat(entry.reading).isEqualTo("メッセージ")
    }

    @Test
    fun `a katakana query matches an entry whose reading jisho writes in hiragana`() {
        // Real shape of jisho's answer to アタシ: it returns 私[あたし] as the top hit. Comparing the
        // scripts literally rejected it, and the lyric's アタシ reached the app with no meaning while
        // the same word on the next line — spelled あたし by the segmentation stage — had one.
        val response = JishoSearchResponse(
            data = listOf(
                JishoEntryRawDto(
                    japanese = listOf(
                        JishoJapaneseDto(word = "私", reading = "あたし"),
                        JishoJapaneseDto(word = "私", reading = "あたくし"),
                    ),
                    senses = listOf(
                        JishoSenseDto(englishDefinitions = listOf("I", "me"), partsOfSpeech = listOf("Pronoun")),
                    ),
                ),
            ),
        )

        val entry = client.distill("アタシ", response)

        assertThat(entry.found).isTrue()
        assertThat(entry.provenance).isEqualTo(JishoLookupProvenance.EXACT)
        assertThat(entry.entries.map { it.headword to it.reading })
            .containsExactly("私" to "アタシ", "私" to "アタクシ")
    }

    @Test
    fun `part of speech carries forward across senses that omit it`() {
        val response = JishoSearchResponse(
            data = listOf(
                JishoEntryRawDto(
                    japanese = listOf(JishoJapaneseDto(word = "行く", reading = "いく")),
                    senses = listOf(
                        JishoSenseDto(englishDefinitions = listOf("to go"), partsOfSpeech = listOf("Godan verb")),
                        JishoSenseDto(englishDefinitions = listOf("to proceed")),
                        JishoSenseDto(englishDefinitions = listOf("Iku"), partsOfSpeech = listOf("Wikipedia definition")),
                    ),
                ),
            ),
        )

        val senses = client.distill("行く", response).entries.single().senses

        assertThat(senses.map { it.english }).containsExactly("to go", "to proceed")
        assertThat(senses.map { it.pos }).containsExactly(listOf("Godan verb"), listOf("Godan verb"))
    }

    @Test
    fun `an element with no kana reading keeps its headword but reports no reading`() {
        // Falling back to the written form would put kanji in a reading field, which then reaches the
        // app's katakana-to-Hangul conversion. Better to have no reading and match on headword alone.
        val response = JishoSearchResponse(
            data = listOf(
                JishoEntryRawDto(
                    japanese = listOf(JishoJapaneseDto(word = "々")),
                    senses = listOf(
                        JishoSenseDto(englishDefinitions = listOf("repetition mark"), partsOfSpeech = listOf("Noun")),
                    ),
                ),
            ),
        )

        val entry = client.distill("々", response).entries.single()

        assertThat(entry.headword).isEqualTo("々")
        assertThat(entry.reading).isNull()
    }

    @Test
    fun `a non-matching top entry is retained as rejected fallback`() {
        val response = JishoSearchResponse(
            data = listOf(
                JishoEntryRawDto(
                    japanese = listOf(JishoJapaneseDto(word = "全然", reading = "ぜんぜん")),
                    senses = listOf(
                        JishoSenseDto(
                            englishDefinitions = listOf("not at all"),
                            partsOfSpeech = listOf("Adverb (fukushi)"),
                        ),
                    ),
                ),
            ),
        )

        val entry = client.distill("ぜんぶ", response)

        assertThat(entry.found).isFalse()
        assertThat(entry.provenance).isEqualTo(JishoLookupProvenance.REJECTED_FALLBACK)
        assertThat(entry.entries.single().reading).isEqualTo("ゼンゼン")
    }

    @Test
    fun `an empty response is a genuine not-found`() {
        val entry = client.distill("ゑゐ", JishoSearchResponse())

        assertThat(entry.found).isFalse()
        assertThat(entry.provenance).isEqualTo(JishoLookupProvenance.NOT_FOUND)
        assertThat(entry.entries).isEmpty()
    }

    private fun maeAndZen() = JishoSearchResponse(
        data = listOf(
            JishoEntryRawDto(
                japanese = listOf(JishoJapaneseDto(word = "前", reading = "ぜん")),
                senses = listOf(
                    JishoSenseDto(
                        englishDefinitions = listOf("before"),
                        partsOfSpeech = listOf("Noun, used as a prefix"),
                    ),
                ),
                jlpt = listOf("jlpt-n1"),
            ),
            JishoEntryRawDto(
                japanese = listOf(JishoJapaneseDto(word = "前", reading = "まえ")),
                senses = listOf(
                    JishoSenseDto(englishDefinitions = listOf("before", "earlier"), partsOfSpeech = listOf("Noun")),
                ),
                jlpt = listOf("jlpt-n5"),
            ),
        ),
    )
}
