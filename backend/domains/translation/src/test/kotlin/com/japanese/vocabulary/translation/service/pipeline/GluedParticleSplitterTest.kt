package com.japanese.vocabulary.translation.service.pipeline

import com.japanese.vocabulary.translation.client.jisho.dto.JishoDictionaryEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import com.japanese.vocabulary.translation.client.jisho.dto.JishoOptionDto
import com.japanese.vocabulary.translation.model.PipelineToken
import com.japanese.vocabulary.translation.service.JishoService
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.runBlocking
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

/**
 * The reason this class exists: the segmentation prompt asks for particles as their own words but
 * nothing enforced it, so `幸せがある` arrived as one token whose reading `ガアル` reached the app as a
 * single word (rendered 가아루). The split fires on the model contradicting itself — surface = headword
 * plus a particle — and every uncertain case is left whole, because a wrong split destroys a real word
 * while leaving one glued only mis-renders a meaning that is already correct.
 */
class GluedParticleSplitterTest {
    private val jishoService = mockk<JishoService>()
    private val splitter = GluedParticleSplitter(jishoService)

    @Test
    fun `a leading particle is split off and the reading divides with it`(): Unit = runBlocking {
        stubMissing("がある")

        val tokens = split(token(surface = "がある", headword = "ある", used = "ガアル", base = "アル", start = 6))

        assertThat(tokens.map { it.surface }).containsExactly("が", "ある")
        assertThat(tokens.map { it.usedReading }).containsExactly("ガ", "アル")
        assertThat(tokens.map { it.charStart to it.charEnd }).containsExactly(6 to 7, 7 to 9)
        assertThat(tokens.last().headword).isEqualTo("ある")
        assertThat(tokens.last().baseFormReading).isEqualTo("アル")
    }

    @Test
    fun `a trailing particle is split off`(): Unit = runBlocking {
        stubMissing("何を")

        val tokens = split(token(surface = "何を", headword = "何", used = "ナニヲ", base = "ナニ", start = 0))

        assertThat(tokens.map { it.surface }).containsExactly("何", "を")
        assertThat(tokens.map { it.usedReading }).containsExactly("ナニ", "ヲ")
        assertThat(tokens.map { it.charStart to it.charEnd }).containsExactly(0 to 1, 1 to 2)
    }

    @Test
    fun `a reading that leaves the particle out keeps the word's reading whole`(): Unit = runBlocking {
        // までは came back with reading マデ, not マデハ: the particle's kana is simply absent, so there
        // is nothing to take off. Dropping a character here would have produced マデ → マ.
        stubMissing("までは")

        val tokens = split(token(surface = "までは", headword = "まで", used = "マデ", base = "マデ", start = 6))

        assertThat(tokens.map { it.surface }).containsExactly("まで", "は")
        assertThat(tokens.map { it.usedReading }).containsExactly("マデ", "ハ")
    }

    @Test
    fun `a particle sung differently from how it is spelled is still recognised`(): Unit = runBlocking {
        // 僕は is sung ボクワ. Reading ワ as part of 僕 would give the app a word pronounced wrong.
        stubMissing("僕は")

        val tokens = split(token(surface = "僕は", headword = "僕", used = "ボクワ", base = "ボク", start = 0))

        assertThat(tokens.map { it.surface }).containsExactly("僕", "は")
        assertThat(tokens.map { it.usedReading }).containsExactly("ボク", "ハ")
    }

    @Test
    fun `a word whose own reading ends in the particle's kana is not shortened`(): Unit = runBlocking {
        // 母 reads ハハ, so the reading ends with the particle's kana without containing the particle.
        // Only the headword's reading can tell this apart from 僕は above.
        stubMissing("母は")

        val tokens = split(token(surface = "母は", headword = "母", used = "ハハ", base = "ハハ", start = 0))

        assertThat(tokens.map { it.surface }).containsExactly("母", "は")
        assertThat(tokens.map { it.usedReading }).containsExactly("ハハ", "ハ")
    }

    @Test
    fun `a glued form the dictionary knows is left whole`(): Unit = runBlocking {
        // いつも is a word. Splitting it into いつ + も would break a real entry into two fragments.
        stubEntry("いつも")

        val tokens = split(token(surface = "いつも", headword = "いつ", used = "イツモ", base = "イツ", start = 0))

        assertThat(tokens.map { it.surface }).containsExactly("いつも")
    }

    @Test
    fun `a lookup that failed leaves the token whole`(): Unit = runBlocking {
        // A network blip must not be read as "this is not a word".
        coEvery { jishoService.lookupAll(any()) } returns mapOf(
            "がある" to JishoEntryDto(found = false, word = "がある", provenance = JishoLookupProvenance.FETCH_ERROR),
        )

        val tokens = split(token(surface = "がある", headword = "ある", used = "ガアル", base = "アル", start = 0))

        assertThat(tokens.map { it.surface }).containsExactly("がある")
    }

    @Test
    fun `an inflected form is not mistaken for a glued particle`(): Unit = runBlocking {
        // です(だ) and ねばった(粘る) are why で and ね are not in the leading-particle set: both start with
        // a character that is a particle elsewhere, and neither is glued.
        val tokens = split(
            token(surface = "です", headword = "だ", used = "デス", base = "ダ", start = 0),
            token(surface = "ねばった", headword = "粘る", used = "ネバッタ", base = "ネバル", start = 2),
        )

        assertThat(tokens.map { it.surface }).containsExactly("です", "ねばった")
        coVerify(exactly = 0) { jishoService.lookupAll(any()) }
    }

    @Test
    fun `an inflected form whose headword differs by more than the particle is not split`(): Unit = runBlocking {
        // 帰れない ends in a character that is not a particle at all, and 離れない's headword is not the
        // surface minus one particle — neither shape matches, so no dictionary call is even made.
        val tokens = split(
            token(surface = "離れない", headword = "離れる", used = "ハナレナイ", base = "ハナレル", start = 4),
        )

        assertThat(tokens.map { it.surface }).containsExactly("離れない")
        coVerify(exactly = 0) { jishoService.lookupAll(any()) }
    }

    private suspend fun split(vararg tokens: PipelineToken): List<PipelineToken> =
        splitter.split(mapOf(0 to tokens.toList())).getValue(0)

    private fun token(surface: String, headword: String, used: String, base: String, start: Int) = PipelineToken(
        lineIndex = 0,
        surface = surface,
        headword = headword,
        charStart = start,
        charEnd = start + surface.length,
        usedReading = used,
        baseFormReading = base,
        contextGloss = "gloss",
    )

    private fun stubMissing(word: String) {
        coEvery { jishoService.lookupAll(any()) } returns mapOf(
            word to JishoEntryDto(found = false, word = word, provenance = JishoLookupProvenance.NOT_FOUND),
        )
    }

    private fun stubEntry(word: String) {
        coEvery { jishoService.lookupAll(any()) } returns mapOf(
            word to JishoEntryDto(
                found = true,
                word = word,
                entries = listOf(
                    JishoDictionaryEntryDto(
                        headword = word,
                        reading = JapaneseText.toKatakana(word),
                        senses = listOf(
                            JishoOptionDto(
                                pos = listOf("Adverb"),
                                english = "always",
                                englishDefinitions = listOf("always"),
                            ),
                        ),
                    ),
                ),
                provenance = JishoLookupProvenance.EXACT,
            ),
        )
    }
}
