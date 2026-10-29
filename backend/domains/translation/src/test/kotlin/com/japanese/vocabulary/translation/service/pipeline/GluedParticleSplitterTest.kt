package com.japanese.vocabulary.translation.service.pipeline

import com.japanese.vocabulary.translation.client.dictionary.dto.DictionaryEntryDto
import com.japanese.vocabulary.translation.client.dictionary.dto.DictionaryLookupDto
import com.japanese.vocabulary.translation.client.dictionary.dto.DictionaryLookupProvenance
import com.japanese.vocabulary.translation.client.dictionary.dto.DictionarySenseDto
import com.japanese.vocabulary.translation.model.PipelineToken
import com.japanese.vocabulary.translation.service.DictionaryService
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.runBlocking
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

/**
 * The split fires on the model contradicting itself (surface = headword plus a particle) and every
 * uncertain case is left whole: a wrong split destroys a real word, a glued one only mis-renders.
 */
class GluedParticleSplitterTest {
    private val dictionaryService = mockk<DictionaryService>()
    private val splitter = GluedParticleSplitter(dictionaryService)

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
        // までは came back with reading マデ: the particle's kana is absent, so nothing is dropped (else マデ → マ).
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
    fun `a particle glued into the headword as well is split off`(): Unit = runBlocking {
        // 誰も彼もが頭を抱え生きている: 彼も came back with headword 彼も too, so the headword offers no anchor.
        stubMissing("彼も")

        val tokens = split(token(surface = "彼も", headword = "彼も", used = "カレモ", base = "カレモ", start = 2))

        assertThat(tokens.map { it.surface }).containsExactly("彼", "も")
        assertThat(tokens.map { it.headword }).containsExactly("彼", "も")
        assertThat(tokens.map { it.usedReading }).containsExactly("カレ", "モ")
        assertThat(tokens.first().baseFormReading).isEqualTo("カレ")
        assertThat(tokens.map { it.charStart to it.charEnd }).containsExactly(2 to 3, 3 to 4)
    }

    @Test
    fun `a word that is its own headword and ends in a particle is kept when the dictionary knows it`(): Unit =
        runBlocking {
            stubEntry("いつも")

            val tokens = split(token(surface = "いつも", headword = "いつも", used = "イツモ", base = "イツモ", start = 0))

            assertThat(tokens.map { it.surface }).containsExactly("いつも")
        }

    @Test
    fun `a trailing no glued into the headword is split off`(): Unit = runBlocking {
        // いつの日か 窮屈なこの部屋を抜け出して: いつの came back as both surface and headword.
        stubMissing("いつの")

        val tokens = split(token(surface = "いつの", headword = "いつの", used = "イツノ", base = "イツノ", start = 0))

        assertThat(tokens.map { it.surface }).containsExactly("いつ", "の")
        assertThat(tokens.map { it.headword }).containsExactly("いつ", "の")
        assertThat(tokens.map { it.usedReading }).containsExactly("イツ", "ノ")
        assertThat(tokens.map { it.charStart to it.charEnd }).containsExactly(0 to 2, 2 to 3)
    }

    @Test
    fun `a word ending in no that the dictionary knows is kept`(): Unit = runBlocking {
        stubEntry("この")

        val tokens = split(token(surface = "この", headword = "この", used = "コノ", base = "コノ", start = 8))

        assertThat(tokens.map { it.surface }).containsExactly("この")
    }

    @Test
    fun `a leading particle glued into the headword too is split off before a kanji word`(): Unit = runBlocking {
        // あぁ、いつか人生最後の日、: の日 came back as both surface and headword.
        stubMissing("の日")

        val tokens = split(token(surface = "の日", headword = "の日", used = "ノヒ", base = "ノヒ", start = 10))

        assertThat(tokens.map { it.surface }).containsExactly("の", "日")
        assertThat(tokens.map { it.headword }).containsExactly("の", "日")
        assertThat(tokens.map { it.usedReading }).containsExactly("ノ", "ヒ")
        assertThat(tokens.map { it.charStart to it.charEnd }).containsExactly(10 to 11, 11 to 12)
        assertThat(tokens.last().baseFormReading).isEqualTo("ヒ")
    }

    @Test
    fun `a kana word the model gave as its own headword is not split`(): Unit = runBlocking {
        // のんびり opens with の but is not glued; only a kanji after the particle marks a word boundary.
        val tokens = split(token(surface = "のんびり", headword = "のんびり", used = "ノンビリ", base = "ノンビリ", start = 0))

        assertThat(tokens.map { it.surface }).containsExactly("のんびり")
        coVerify(exactly = 0) { dictionaryService.lookupAll(any()) }
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
        coEvery { dictionaryService.lookupAll(any()) } returns mapOf(
            "がある" to DictionaryLookupDto(found = false, word = "がある", provenance = DictionaryLookupProvenance.FETCH_ERROR),
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
        coVerify(exactly = 0) { dictionaryService.lookupAll(any()) }
    }

    @Test
    fun `an inflected form whose headword differs by more than the particle is not split`(): Unit = runBlocking {
        // Neither shape matches (帰れない does not end in a particle; 離れない's headword is not the
        // surface minus one), so no dictionary call is made.
        val tokens = split(
            token(surface = "離れない", headword = "離れる", used = "ハナレナイ", base = "ハナレル", start = 4),
        )

        assertThat(tokens.map { it.surface }).containsExactly("離れない")
        coVerify(exactly = 0) { dictionaryService.lookupAll(any()) }
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
        coEvery { dictionaryService.lookupAll(any()) } returns mapOf(
            word to DictionaryLookupDto(found = false, word = word, provenance = DictionaryLookupProvenance.NOT_FOUND),
        )
    }

    private fun stubEntry(word: String) {
        coEvery { dictionaryService.lookupAll(any()) } returns mapOf(
            word to DictionaryLookupDto(
                found = true,
                word = word,
                entries = listOf(
                    DictionaryEntryDto(
                        headword = word,
                        reading = JapaneseText.toKatakana(word),
                        senses = listOf(
                            DictionarySenseDto(
                                pos = listOf("Adverb"),
                                english = "always",
                                englishDefinitions = listOf("always"),
                            ),
                        ),
                    ),
                ),
                provenance = DictionaryLookupProvenance.EXACT,
            ),
        )
    }
}
