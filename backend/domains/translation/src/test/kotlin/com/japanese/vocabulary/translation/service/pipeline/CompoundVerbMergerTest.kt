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

class CompoundVerbMergerTest {
    private val dictionaryService = mockk<DictionaryService>()
    private val merger = CompoundVerbMerger(dictionaryService)

    @Test
    fun `a godan stem and a verb the dictionary knows as one compound become one token`(): Unit = runBlocking {
        // 握り返せない: 握り(握る) + 返せ(返す) loses "squeeze back".
        stub(verb("握り返す", "ニギリカエス"))

        val tokens = merge(
            token("握り", "握る", "ニギリ", "ニギル", 0),
            token("返せ", "返す", "カエセ", "カエス", 2),
            token("ない", "ない", "ナイ", "ナイ", 4),
        )

        assertThat(tokens.map { it.surface }).containsExactly("握り返せ", "ない")
        val compound = tokens.first()
        assertThat(compound.headword).isEqualTo("握り返す")
        assertThat(compound.charStart to compound.charEnd).isEqualTo(0 to 4)
        assertThat(compound.usedReading).isEqualTo("ニギリカエセ")
        assertThat(compound.baseFormReading).isEqualTo("ニギリカエス")
    }

    @Test
    fun `an ichidan stem joins a kana second verb through the compound's reading`(): Unit = runBlocking {
        // 混ざりあう is indexed only as 混ざり合う.
        stub(verb("混ざり合う", "マザリアウ"), query = "まざりあう")

        val tokens = merge(
            token("混ざり", "混ざる", "マザリ", "マザル", 0),
            token("あう", "あう", "アウ", "アウ", 3),
        )

        assertThat(tokens.single().headword).isEqualTo("混ざり合う")
    }

    @Test
    fun `two verbs the dictionary has no compound for stay apart`(): Unit = runBlocking {
        coEvery { dictionaryService.lookupAll(any()) } answers {
            firstArg<List<String>>().associateWith { DictionaryLookupDto(found = false, word = it, provenance = DictionaryLookupProvenance.NOT_FOUND) }
        }

        val tokens = merge(token("泣き", "泣く", "ナキ", "ナク", 0), token("笑う", "笑う", "ワラウ", "ワラウ", 2))

        assertThat(tokens.map { it.surface }).containsExactly("泣き", "笑う")
    }

    @Test
    fun `a godan imperative is not taken for a stem`(): Unit = runBlocking {
        val tokens = merge(token("立て", "立つ", "タテ", "タツ", 0), token("走る", "走る", "ハシル", "ハシル", 2))

        assertThat(tokens.map { it.surface }).containsExactly("立て", "走る")
        coVerify(exactly = 0) { dictionaryService.lookupAll(any()) }
    }

    @Test
    fun `two halves the model gave one headword are one token`(): Unit = runBlocking {
        val tokens = merge(token("黄昏", "黄昏る", "タソガレ", "タソガレル", 0), token("る", "黄昏る", "ル", "タソガレル", 2))

        assertThat(tokens.single().surface).isEqualTo("黄昏る")
        assertThat(tokens.single().usedReading).isEqualTo("タソガレル")
    }

    @Test
    fun `a repeated word is left as two tokens`(): Unit = runBlocking {
        val tokens = merge(token("好き", "好き", "スキ", "スキ", 0), token("好き", "好き", "スキ", "スキ", 2))

        assertThat(tokens).hasSize(2)
    }

    private suspend fun merge(vararg tokens: PipelineToken) = merger.merge(mapOf(0 to tokens.toList())).getValue(0)

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

    private fun verb(headword: String, reading: String) = DictionaryEntryDto(
        headword = headword,
        reading = reading,
        senses = listOf(DictionarySenseDto(pos = listOf("Godan verb with 'su' ending"), english = "to do")),
    )

    private fun stub(entry: DictionaryEntryDto, query: String = entry.headword!!) {
        coEvery { dictionaryService.lookupAll(any()) } answers {
            firstArg<List<String>>().associateWith { word ->
                if (word == query) {
                    DictionaryLookupDto(found = true, word = word, entries = listOf(entry), provenance = DictionaryLookupProvenance.EXACT)
                } else {
                    DictionaryLookupDto(found = false, word = word, provenance = DictionaryLookupProvenance.NOT_FOUND)
                }
            }
        }
    }
}
