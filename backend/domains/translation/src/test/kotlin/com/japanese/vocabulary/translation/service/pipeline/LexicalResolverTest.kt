package com.japanese.vocabulary.translation.service.pipeline

import com.japanese.vocabulary.translation.client.jisho.dto.JishoDictionaryEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import com.japanese.vocabulary.translation.client.jisho.dto.JishoOptionDto
import com.japanese.vocabulary.translation.model.PipelineToken
import com.japanese.vocabulary.translation.service.JishoService
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.runBlocking
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

/**
 * The reason this class exists: a headword lookup can answer with several dictionary entries, and the
 * pair `(headword, baseFormReading)` is what picks one. The reading comes from an LLM, so a miss is
 * graded rather than dropped.
 */
class LexicalResolverTest {
    private val jishoService = mockk<JishoService>()
    private val resolver = LexicalResolver(jishoService)

    @Test
    fun `a matching pair narrows to that entry alone`(): Unit = runBlocking {
        stub("前" to maeAndZenAndSaki())

        val resolved = resolver.resolve(listOf(token("前", "前", "マエ"))).byTokenKey.values.single()

        assertThat(resolved.options.map { it.english }).containsExactly("before / earlier")
        assertThat(resolved.options.map { it.reading }).containsExactly("マエ")
        assertThat(resolved.options).allSatisfy {
            assertThat(it.provenance).isEqualTo(JishoLookupProvenance.EXACT)
        }
    }

    @Test
    fun `the other reading of the same spelling picks the other entry`(): Unit = runBlocking {
        stub("前" to maeAndZenAndSaki())

        val resolved = resolver.resolve(listOf(token("前", "前", "ゼン"))).byTokenKey.values.single()

        assertThat(resolved.options.map { it.english }).containsExactly("previous, before")
        assertThat(resolved.options.map { it.jlpt }).containsExactly(listOf("jlpt-n1"))
    }

    @Test
    fun `a wrong reading with only one candidate entry is approved rather than dropped`(): Unit = runBlocking {
        stub(
            "猫" to found(
                entry(headword = "猫", reading = "ネコ", english = "cat"),
            ),
        )

        val resolved = resolver.resolve(listOf(token("猫", "猫", "ミャオ"))).byTokenKey.values.single()

        assertThat(resolved.options.map { it.english }).containsExactly("cat")
        assertThat(resolved.options.single().provenance).isEqualTo(JishoLookupProvenance.APPROVED_FALLBACK)
    }

    @Test
    fun `a wrong reading with several candidate entries keeps them all, entry-labelled`(): Unit = runBlocking {
        stub("前" to maeAndZenAndSaki())

        val resolved = resolver.resolve(listOf(token("前", "前", "マチガイ"))).byTokenKey.values.single()

        // 先[サキ] is excluded — its headword is 先, not 前 — but both 前 entries stay in play.
        assertThat(resolved.options.map { it.headword to it.reading })
            .containsExactly("前" to "ゼン", "前" to "マエ")
        assertThat(resolved.options).allSatisfy {
            assertThat(it.provenance).isEqualTo(JishoLookupProvenance.AMBIGUOUS_HEADWORD)
        }
    }

    @Test
    fun `an entry whose headword never matches yields no candidates`(): Unit = runBlocking {
        stub("ぜんぶ" to found(entry(headword = "全然", reading = "ゼンゼン", english = "not at all")))

        val resolved = resolver.resolve(listOf(token("ぜんぶ", "ぜんぶ", "ゼンブ"))).byTokenKey.values.single()

        assertThat(resolved.options).isEmpty()
    }

    @Test
    fun `a rejected fallback never reaches sense selection`(): Unit = runBlocking {
        stub(
            "こうも" to JishoEntryDto(
                found = false,
                word = "こうも",
                entries = listOf(entry(headword = "こうも", reading = "コウモ", english = "irrelevant")),
                provenance = JishoLookupProvenance.REJECTED_FALLBACK,
            ),
        )

        val resolved = resolver.resolve(listOf(token("こうも", "こうも", "コウモ"))).byTokenKey.values.single()

        assertThat(resolved.options).isEmpty()
    }

    @Test
    fun `a kana-only entry matches on its reading`(): Unit = runBlocking {
        stub("メッセージ" to found(entry(headword = null, reading = "メッセージ", english = "message")))

        val resolved = resolver.resolve(
            listOf(token("メッセージ", "メッセージ", "メッセージ")),
        ).byTokenKey.values.single()

        assertThat(resolved.options.map { it.english }).containsExactly("message")
    }

    @Test
    fun `a reading that matches several entries is ambiguous, not exact`(): Unit = runBlocking {
        // Lyrics write かける in kana, so かける IS the headword — and 掛ける / 賭ける / 欠ける all read
        // カケル. The pair matches three times, which names no single word. Calling that EXACT would
        // send three unrelated glosses with nothing marking them as different words, which is the
        // failure entry boundaries exist to prevent.
        stub(
            "かける" to found(
                entry(headword = "掛ける", reading = "カケル", english = "to hang"),
                entry(headword = "賭ける", reading = "カケル", english = "to bet"),
                entry(headword = "欠ける", reading = "カケル", english = "to be chipped"),
            ),
        )

        val resolved = resolver.resolve(listOf(token("かけて", "かける", "カケル"))).byTokenKey.values.single()

        assertThat(resolved.options).allSatisfy {
            assertThat(it.provenance).isEqualTo(JishoLookupProvenance.AMBIGUOUS_HEADWORD)
        }
        assertThat(resolved.options.map { it.headword })
            .containsExactly("掛ける", "賭ける", "欠ける")
    }

    @Test
    fun `a kana headword whose homophones all carry kanji spellings stays ambiguous`(): Unit = runBlocking {
        // Real jisho shape for もう: six entries, only one of them kana-headed. Matching purely on
        // headword would drop the correct meaning; grading the whole set EXACT would send
        // "already / greatly energetic / one-thousandth / network / ignorance / blindness" with no way
        // to tell them apart. Neither is acceptable, so they go out labelled.
        stub(
            "もう" to found(
                entry(headword = null, reading = "モウ", english = "already, yet"),
                entry(headword = "猛", reading = "モウ", english = "greatly energetic"),
                entry(headword = "毛", reading = "モウ", english = "one-thousandth"),
                entry(headword = "網", reading = "モウ", english = "network"),
                entry(headword = "蒙", reading = "モウ", english = "ignorance"),
                entry(headword = "盲", reading = "モウ", english = "blindness"),
            ),
        )

        val resolved = resolver.resolve(listOf(token("もう", "もう", "モウ"))).byTokenKey.values.single()

        assertThat(resolved.options).hasSize(6)
        assertThat(resolved.options).allSatisfy {
            assertThat(it.provenance).isEqualTo(JishoLookupProvenance.AMBIGUOUS_HEADWORD)
        }
    }

    @Test
    fun `a kana headword with no kana-headed entry still keeps every meaning`(): Unit = runBlocking {
        // ここ has no kana headword in jisho — every candidate is kanji-spelled. Restricting the
        // reading clause to kana-only entries would leave this word with no meaning at all.
        stub(
            "ここ" to found(
                entry(headword = "此処", reading = "ココ", english = "here"),
                entry(headword = "個々", reading = "ココ", english = "individual"),
            ),
        )

        val resolved = resolver.resolve(listOf(token("ここ", "ここ", "ココ"))).byTokenKey.values.single()

        assertThat(resolved.options.map { it.english }).containsExactly("here", "individual")
    }

    @Test
    fun `an i-adjective rescued through the probe is graded exact, not a fallback`(): Unit = runBlocking {
        // The probe fires because the model gave 高く as the headword. Its reading タカク belongs to
        // that wrong headword, so comparing the probed entry against it would call every rescue a
        // fallback and understate the EXACT ratio for the population the probe exists to save.
        stub(
            "高い" to found(
                JishoDictionaryEntryDto(
                    headword = "高い",
                    reading = "タカイ",
                    senses = listOf(
                        JishoOptionDto(
                            pos = listOf("I-adjective (keiyoushi)"),
                            english = "high / tall",
                            englishDefinitions = listOf("high", "tall"),
                        ),
                    ),
                ),
            ),
        )

        val resolved = resolver.resolve(listOf(token("高く", "高く", "タカク"))).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("高い")
        assertThat(resolved.options.single().provenance).isEqualTo(JishoLookupProvenance.EXACT)
    }

    @Test
    fun `a katakana headword the dictionary indexes in hiragana is queried again in hiragana`(): Unit = runBlocking {
        // jisho's search is script-sensitive: アンタ answers with アンタレス and アンタナナリボ, never 貴方.
        // Only the script of the query is wrong, and the lyric writing 貴方 as アンタ is ordinary J-pop,
        // so the word must not lose its meaning over it.
        stub(
            "アンタ" to JishoEntryDto(
                found = false,
                word = "アンタ",
                entries = listOf(entry(headword = null, reading = "アンタレス", english = "Antares")),
                provenance = JishoLookupProvenance.REJECTED_FALLBACK,
            ),
            "あんた" to found(entry(headword = "貴方", reading = "アンタ", english = "you")),
        )

        val resolved = resolver.resolve(listOf(token("アンタ", "アンタ", "アンタ"))).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("あんた")
        assertThat(resolved.options.map { it.english }).containsExactly("you")
        assertThat(resolved.options.single().provenance).isEqualTo(JishoLookupProvenance.EXACT)
    }

    @Test
    fun `the hiragana query reports the same token as unresolved as the full resolve does`(): Unit = runBlocking {
        // The early probe exists to let segmentation retry a line, so a word the rescue saves must not
        // be reported as a miss — it would burn a retry on a line that is already correct.
        stub("あんた" to found(entry(headword = "貴方", reading = "アンタ", english = "you")))

        val missed = resolver.unresolvedTokens(listOf(token("アンタ", "アンタ", "アンタ")))

        assertThat(missed).isEmpty()
    }

    @Test
    fun `a katakana word no dictionary answers in either script stays without candidates`(): Unit = runBlocking {
        // The rescue switches the script, it does not invent an entry: a coinage the lyric made up
        // misses in hiragana too, and it is exempt from the headword check for exactly that reason.
        stub()

        val resolved = resolver.resolve(
            listOf(token("ステンバイミー", "ステンバイミー", "ステンバイミー")),
        ).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("ステンバイミー")
        assertThat(resolved.options).isEmpty()
    }

    @Test
    fun `the same word on several lines shares one senseId per dictionary sense`(): Unit = runBlocking {
        // A minted-per-occurrence id sent the same sense to sense-translate once per line, and the
        // model wrote a different Korean gloss each time — one word, three near-identical senses.
        stub("シャイ" to found(entry(headword = null, reading = "シャイ", english = "shy")))

        val resolution = resolver.resolve(
            listOf(
                token("シャイ", "シャイ", "シャイ", lineIndex = 14),
                token("シャイ", "シャイ", "シャイ", lineIndex = 42),
                token("シャイ", "シャイ", "シャイ", lineIndex = 68),
            ),
        )

        assertThat(resolution.optionsById).hasSize(1)
        assertThat(resolution.byTokenKey.values.map { it.options.single().senseId }).containsOnly(0)
    }

    @Test
    fun `senses of different entries keep separate ids`(): Unit = runBlocking {
        stub("前" to maeAndZenAndSaki())

        val resolution = resolver.resolve(
            listOf(
                token("前", "前", "マエ", lineIndex = 1),
                token("前", "前", "ゼン", lineIndex = 2),
            ),
        )

        assertThat(resolution.optionsById).hasSize(2)
        assertThat(resolution.optionsById.values.map { it.reading }).containsExactlyInAnyOrder("マエ", "ゼン")
    }

    private fun stub(vararg entries: Pair<String, JishoEntryDto>) {
        val byWord = entries.toMap()
        coEvery { jishoService.lookupAll(any()) } answers {
            firstArg<List<String>>().associateWith { byWord[it] ?: JishoEntryDto(found = false, word = it) }
        }
    }

    /** 前 answers with 前[ゼン], 前[マエ], and — via the 先 entry's alternate spelling — 先[サキ]. */
    private fun maeAndZenAndSaki() = found(
        entry(headword = "前", reading = "ゼン", english = "previous, before", jlpt = listOf("jlpt-n1")),
        entry(headword = "前", reading = "マエ", english = "before / earlier", jlpt = listOf("jlpt-n5")),
        entry(headword = "先", reading = "サキ", english = "ahead, previous"),
    )

    private fun found(vararg entries: JishoDictionaryEntryDto) = JishoEntryDto(
        found = true,
        word = entries.first().headword ?: entries.first().reading.orEmpty(),
        entries = entries.toList(),
        provenance = JishoLookupProvenance.EXACT,
    )

    private fun entry(
        headword: String?,
        reading: String,
        english: String,
        jlpt: List<String> = emptyList(),
    ) = JishoDictionaryEntryDto(
        headword = headword,
        reading = reading,
        jlpt = jlpt,
        senses = listOf(
            JishoOptionDto(pos = listOf("Noun"), english = english, englishDefinitions = listOf(english)),
        ),
    )

    private fun token(
        surface: String,
        headword: String,
        baseFormReading: String,
        lineIndex: Int = 0,
    ) = PipelineToken(
        lineIndex = lineIndex,
        surface = surface,
        headword = headword,
        charStart = 0,
        charEnd = surface.length,
        usedReading = baseFormReading,
        baseFormReading = baseFormReading,
        contextGloss = "gloss",
    )
}
