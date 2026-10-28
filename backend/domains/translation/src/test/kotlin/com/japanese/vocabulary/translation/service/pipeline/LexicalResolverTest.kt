package com.japanese.vocabulary.translation.service.pipeline

import com.japanese.vocabulary.translation.client.dictionary.dto.DictionaryEntryDto
import com.japanese.vocabulary.translation.client.dictionary.dto.DictionaryLookupDto
import com.japanese.vocabulary.translation.client.dictionary.dto.DictionaryLookupProvenance
import com.japanese.vocabulary.translation.client.dictionary.dto.DictionarySenseDto
import com.japanese.vocabulary.translation.model.PipelineToken
import com.japanese.vocabulary.translation.service.DictionaryService
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
    private val dictionaryService = mockk<DictionaryService>()
    private val resolver = LexicalResolver(dictionaryService)

    @Test
    fun `a matching pair narrows to that entry alone`(): Unit = runBlocking {
        stub("前" to maeAndZenAndSaki())

        val resolved = resolver.resolve(listOf(token("前", "前", "マエ"))).byTokenKey.values.single()

        assertThat(resolved.options.map { it.english }).containsExactly("before / earlier")
        assertThat(resolved.options.map { it.reading }).containsExactly("マエ")
        assertThat(resolved.options).allSatisfy {
            assertThat(it.provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
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
        assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.APPROVED_FALLBACK)
    }

    @Test
    fun `a wrong reading with several candidate entries keeps them all, entry-labelled`(): Unit = runBlocking {
        stub("前" to maeAndZenAndSaki())

        val resolved = resolver.resolve(listOf(token("前", "前", "マチガイ"))).byTokenKey.values.single()

        // 先[サキ] is excluded — its headword is 先, not 前 — but both 前 entries stay in play.
        assertThat(resolved.options.map { it.headword to it.reading })
            .containsExactly("前" to "ゼン", "前" to "マエ")
        assertThat(resolved.options).allSatisfy {
            assertThat(it.provenance).isEqualTo(DictionaryLookupProvenance.AMBIGUOUS_HEADWORD)
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
            "こうも" to DictionaryLookupDto(
                found = false,
                word = "こうも",
                entries = listOf(entry(headword = "こうも", reading = "コウモ", english = "irrelevant")),
                provenance = DictionaryLookupProvenance.REJECTED_FALLBACK,
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
        // かける is the headword and 掛ける / 賭ける / 欠ける all read カケル: three matches name no single
        // word, so EXACT would send unrelated glosses unmarked.
        stub(
            "かける" to found(
                entry(headword = "掛ける", reading = "カケル", english = "to hang"),
                entry(headword = "賭ける", reading = "カケル", english = "to bet"),
                entry(headword = "欠ける", reading = "カケル", english = "to be chipped"),
            ),
        )

        val resolved = resolver.resolve(listOf(token("かけて", "かける", "カケル"))).byTokenKey.values.single()

        assertThat(resolved.options).allSatisfy {
            assertThat(it.provenance).isEqualTo(DictionaryLookupProvenance.AMBIGUOUS_HEADWORD)
        }
        assertThat(resolved.options.map { it.headword })
            .containsExactly("掛ける", "賭ける", "欠ける")
    }

    @Test
    fun `a kana headword whose homophones all carry kanji spellings stays ambiguous`(): Unit = runBlocking {
        // Real dictionary shape for もう: six entries, only one kana-headed. Matching on headword alone would
        // drop the correct meaning and grading all EXACT would send unlabelled homophones, so they go out labelled.
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
            assertThat(it.provenance).isEqualTo(DictionaryLookupProvenance.AMBIGUOUS_HEADWORD)
        }
    }

    @Test
    fun `a kana headword with no kana-headed entry still keeps every meaning`(): Unit = runBlocking {
        // ここ has no kana headword in the dictionary — every candidate is kanji-spelled. Restricting the
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
        // The reading タカク belongs to the wrong headword 高く; comparing the probed entry against it
        // would call every rescue a fallback.
        stub(
            "高い" to found(
                DictionaryEntryDto(
                    headword = "高い",
                    reading = "タカイ",
                    senses = listOf(
                        DictionarySenseDto(
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
        assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
    }

    @Test
    fun `a classical adjective ending in shi is looked up as its modern i-adjective`(): Unit = runBlocking {
        // 恙なし is the classical terminal form of 恙ない; the dictionary indexes only the modern form.
        stub(
            "恙ない" to found(
                DictionaryEntryDto(
                    headword = "恙ない",
                    reading = "ツツガナイ",
                    senses = listOf(
                        DictionarySenseDto(
                            pos = listOf("I-adjective (keiyoushi)"),
                            english = "safe / well / healthy",
                            englishDefinitions = listOf("safe", "well", "healthy"),
                        ),
                    ),
                ),
            ),
        )
        val tokens = listOf(token("恙なし", "恙なし", "ツツガナシ", lineIndex = 2))

        val resolved = resolver.resolve(tokens).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("恙ない")
        assertThat(resolved.options.map { it.english }).containsExactly("safe / well / healthy")
        assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
    }

    @Test
    fun `a suru-verb desiderative handed back as the headword is rescued as stem plus suru`(): Unit = runBlocking {
        // 愛したくない has no dictionary entry. The reading アイシタクナイ belongs to that wrong headword, so it
        // is inflected back to アイスル alongside the base form.
        stub(
            "愛する" to found(
                DictionaryEntryDto(
                    headword = "愛する",
                    reading = "アイスル",
                    senses = listOf(
                        DictionarySenseDto(
                            pos = listOf("Suru verb - special class", "Transitive verb"),
                            english = "to love",
                            englishDefinitions = listOf("to love"),
                        ),
                    ),
                ),
            ),
        )

        val resolved = resolver.resolve(
            listOf(token("愛したくない", "愛したくない", "アイシタクナイ", lineIndex = 30)),
        ).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("愛する")
        assertThat(resolved.options.map { it.english }).containsExactly("to love")
        assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
    }

    @Test
    fun `the suru-verb probe reports the same token as unresolved as the full resolve does`(): Unit = runBlocking {
        stub("愛する" to found(entry(headword = "愛する", reading = "アイスル", english = "to love")))

        val missed = resolver.unresolvedTokens(
            listOf(token("愛したくない", "愛したくない", "アイシタクナイ", lineIndex = 49)),
        )

        assertThat(missed).isEmpty()
    }

    @Test
    fun `a godan su-verb desiderative is rescued as stem plus su`(): Unit = runBlocking {
        // 吐き出したい is 吐き出す, a godan verb whose masu stem ends in し; probing only 吐き出する finds nothing.
        stub(
            "吐き出す" to found(
                DictionaryEntryDto(
                    headword = "吐き出す",
                    reading = "ハキダス",
                    senses = listOf(
                        DictionarySenseDto(
                            pos = listOf("Godan verb with 'su' ending", "Transitive verb"),
                            english = "to vomit, to spit out",
                            englishDefinitions = listOf("to vomit", "to spit out"),
                        ),
                    ),
                ),
            ),
        )
        val tokens = listOf(token("吐き出したい", "吐き出したい", "ハキダシタイ"))

        val resolved = resolver.resolve(tokens).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("吐き出す")
        assertThat(resolved.options.map { it.english }).containsExactly("to vomit, to spit out")
        assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
    }

    @Test
    fun `a godan verb's desiderative is not mistaken for a suru-verb`(): Unit = runBlocking {
        // 話したい is 話す; no entry carries 話する, so the token stays unresolved rather than gaining an invented meaning.
        stub("話する" to found(entry(headword = "話", reading = "ハナシ", english = "talk")))

        val resolved = resolver.resolve(listOf(token("話したい", "話したい", "ハナシタイ"))).byTokenKey.values.single()

        assertThat(resolved.options).isEmpty()
    }

    @Test
    fun `a passive handed back as the headword is rescued as its dictionary form`(): Unit = runBlocking {
        // The model kept the passive 呑み込まれる as the headword; the dictionary has no such entry.
        stub(
            "呑み込む" to found(
                DictionaryEntryDto(
                    headword = "呑み込む",
                    reading = "ノミコム",
                    senses = listOf(
                        DictionarySenseDto(
                            pos = listOf("Godan verb with 'mu' ending", "Transitive verb"),
                            english = "to swallow",
                            englishDefinitions = listOf("to swallow"),
                        ),
                    ),
                ),
            ),
        )
        val tokens = listOf(token("呑み込まれた", "呑み込まれる", "ノミコマレル", lineIndex = 6))

        val resolved = resolver.resolve(tokens).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("呑み込む")
        assertThat(resolved.options.map { it.english }).containsExactly("to swallow")
        assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
    }

    @Test
    fun `a suru verb rescued through the probe is graded exact`(): Unit = runBlocking {
        // The dictionary indexes 交差 as a noun that takes する, never 交差する itself.
        stub(
            "交差" to found(
                DictionaryEntryDto(
                    headword = "交差",
                    reading = "コウサ",
                    senses = listOf(
                        DictionarySenseDto(
                            pos = listOf("Noun", "Suru verb", "Intransitive verb"),
                            english = "to intersect, to cross",
                            englishDefinitions = listOf("to intersect", "to cross"),
                        ),
                        DictionarySenseDto(
                            pos = listOf("Noun"),
                            english = "crossing",
                            englishDefinitions = listOf("crossing"),
                        ),
                    ),
                ),
            ),
        )
        val tokens = listOf(token("交差する", "交差する", "コウサスル"))

        val resolved = resolver.resolve(tokens).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("交差")
        assertThat(resolved.options.map { it.english }).containsExactly("to intersect, to cross")
        assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
    }

    @Test
    fun `a noun written with a trailing り is looked up without it`(): Unit = runBlocking {
        // 光り is the noun 光 spelled with 光る's continuative okurigana; the dictionary indexes only 光.
        stub(
            "光" to found(
                DictionaryEntryDto(
                    headword = "光",
                    reading = "ヒカリ",
                    senses = listOf(
                        DictionarySenseDto(
                            pos = listOf("Noun"),
                            english = "light, illumination",
                            englishDefinitions = listOf("light", "illumination"),
                        ),
                    ),
                ),
            ),
        )
        val tokens = listOf(token("光り", "光り", "ヒカリ"))

        val resolved = resolver.resolve(tokens).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("光")
        assertThat(resolved.options.map { it.english }).containsExactly("light, illumination")
        assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
    }

    @Test
    fun `the trailing り rescue keeps only noun senses`(): Unit = runBlocking {
        // A stripped headword that answers only as a verb is a different word, not the noun the
        // lyric spelled with り.
        stub(
            "光" to found(
                DictionaryEntryDto(
                    headword = "光",
                    reading = "ヒカリ",
                    senses = listOf(
                        DictionarySenseDto(
                            pos = listOf("Godan verb with 'ru' ending", "Intransitive verb"),
                            english = "to shine",
                            englishDefinitions = listOf("to shine"),
                        ),
                    ),
                ),
            ),
        )

        val resolved = resolver.resolve(listOf(token("光り", "光り", "ヒカリ"))).byTokenKey.values.single()

        assertThat(resolved.options).isEmpty()
    }

    @Test
    fun `a katakana headword the dictionary indexes in hiragana is queried again in hiragana`(): Unit = runBlocking {
        // The katakana query is stubbed to miss, so 貴方 is only reached through the hiragana probe.
        stub(
            "アンタ" to DictionaryLookupDto(
                found = false,
                word = "アンタ",
                entries = listOf(entry(headword = null, reading = "アンタレス", english = "Antares")),
                provenance = DictionaryLookupProvenance.REJECTED_FALLBACK,
            ),
            "あんた" to found(entry(headword = "貴方", reading = "アンタ", english = "you")),
        )

        val resolved = resolver.resolve(listOf(token("アンタ", "アンタ", "アンタ"))).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("あんた")
        assertThat(resolved.options.map { it.english }).containsExactly("you")
        assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
    }

    @Test
    fun `the hiragana query reports the same token as unresolved as the full resolve does`(): Unit = runBlocking {
        // A word the rescue saves must not be reported as a miss, or it burns a retry on a correct line.
        stub("あんた" to found(entry(headword = "貴方", reading = "アンタ", english = "you")))

        val missed = resolver.unresolvedTokens(listOf(token("アンタ", "アンタ", "アンタ")))

        assertThat(missed).isEmpty()
    }

    @Test
    fun `a headword stretched with a small vowel kana is queried again at full size`(): Unit = runBlocking {
        // さぁ is the interjection さあ drawn out with a small ぁ; the dictionary indexes only さあ.
        stub("さあ" to found(entry(headword = "さあ", reading = "サア", english = "come now")))

        val tokens = listOf(token("さぁ", "さぁ", "サァ", lineIndex = 39))
        val resolved = resolver.resolve(tokens).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("さあ")
        assertThat(resolved.options.map { it.english }).containsExactly("come now")
        assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
    }

    @Test
    fun `an intensifier-prefixed verb is looked up without its prefix`(): Unit = runBlocking {
        // ぶち壊れる is colloquial ぶち + 壊れる; the dictionary has no entry for the compound.
        stub(
            "壊れる" to found(
                DictionaryEntryDto(
                    headword = "壊れる",
                    reading = "コワレル",
                    senses = listOf(
                        DictionarySenseDto(
                            pos = listOf("Ichidan verb", "Intransitive verb"),
                            english = "to be broken",
                            englishDefinitions = listOf("to be broken", "to break"),
                        ),
                        DictionarySenseDto(
                            pos = listOf("Noun"),
                            english = "irrelevant noun sense",
                            englishDefinitions = listOf("irrelevant noun sense"),
                        ),
                    ),
                ),
            ),
        )

        val resolved = resolver.resolve(
            listOf(token("ぶちこわれた", "ぶち壊れる", "ブチコワレル")),
        ).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("壊れる")
        assertThat(resolved.options.map { it.english }).containsExactly("to be broken")
        assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
    }

    @Test
    fun `the prefix-stripped verb is not reported as unresolved`(): Unit = runBlocking {
        stub(
            "壊れる" to found(
                DictionaryEntryDto(
                    headword = "壊れる",
                    reading = "コワレル",
                    senses = listOf(
                        DictionarySenseDto(
                            pos = listOf("Ichidan verb"),
                            english = "to be broken",
                            englishDefinitions = listOf("to be broken"),
                        ),
                    ),
                ),
            ),
        )

        val missed = resolver.unresolvedTokens(listOf(token("ぶちこわれた", "ぶち壊れる", "ブチコワレル")))

        assertThat(missed).isEmpty()
    }

    @Test
    fun `a hiragana word stretched with the prolonged sound mark is looked up in its standard spelling`(): Unit =
        runBlocking {
            // The dictionary indexes ぎゅうぎゅう; the lyric's ー spelling has no entry.
            stub("ぎゅうぎゅう" to found(entry(headword = null, reading = "ギュウギュウ", english = "jam-packed")))
            val tokens = listOf(token("ぎゅーぎゅー", "ぎゅーぎゅー", "ギューギュー", lineIndex = 30))

            val resolved = resolver.resolve(tokens).byTokenKey.values.single()

            assertThat(resolved.baseForm).isEqualTo("ぎゅうぎゅう")
            assertThat(resolved.options.map { it.english }).containsExactly("jam-packed")
            assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
            assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
        }

    @Test
    fun `a variant kanji headword is looked up in its standard spelling`(): Unit = runBlocking {
        // 閧 is a variant of 鬨 (war cry); the dictionary indexes only 鬨.
        stub("鬨" to found(entry(headword = "鬨", reading = "トキ", english = "war cry")))
        val tokens = listOf(token("閧", "閧", "トキ", lineIndex = 29))

        val resolved = resolver.resolve(tokens).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("鬨")
        assertThat(resolved.options.map { it.english }).containsExactly("war cry")
        assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
    }

    @Test
    fun `a lookup the dictionary could not read is reported as a provider error, not a miss`(): Unit = runBlocking {
        // A read failure must be distinguishable from a missing entry: one is retried against the dictionary,
        // the other against the model.
        stub("太陽" to DictionaryLookupDto(found = false, provenance = DictionaryLookupProvenance.FETCH_ERROR))

        val missed = resolver.unresolvedTokens(
            listOf(token("太陽", "太陽", "タイヨウ"), token("鬱雑い", "鬱雑い", "ウザイ")),
        )

        assertThat(missed.map { it.token.headword to it.providerError })
            .containsExactly("太陽" to true, "鬱雑い" to false)
    }

    @Test
    fun `a katakana word no dictionary answers in either script stays without candidates`(): Unit = runBlocking {
        // The rescue switches the script, it does not invent an entry: a coinage misses in hiragana too.
        stub()

        val resolved = resolver.resolve(
            listOf(token("ステンバイミー", "ステンバイミー", "ステンバイミー")),
        ).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("ステンバイミー")
        assertThat(resolved.options).isEmpty()
    }

    @Test
    fun `the same word on several lines shares one senseId per dictionary sense`(): Unit = runBlocking {
        // A per-occurrence id sent the same sense to sense-translate once per line, yielding a different gloss each time.
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
    fun `a kanji headword the dictionary does not answer is queried again by its reading`(): Unit = runBlocking {
        // 燻む answers nothing as a kanji query; the reading くすむ finds it and the pair match keeps the クスム entry.
        stub(
            "くすむ" to found(
                DictionaryEntryDto(
                    headword = "燻む",
                    reading = "クスム",
                    senses = listOf(
                        DictionarySenseDto(
                            pos = listOf("Godan verb with 'mu' ending", "Intransitive verb"),
                            english = "to be dull, to be somber",
                            englishDefinitions = listOf("to be dull", "to be somber"),
                        ),
                    ),
                ),
            ),
        )
        val tokens = listOf(token("燻んで", "燻む", "クスム", lineIndex = 10))

        val resolved = resolver.resolve(tokens).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("燻む")
        assertThat(resolved.options.map { it.english }).containsExactly("to be dull, to be somber")
        assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
    }

    @Test
    fun `a kanji headword's reading query does not adopt an unrelated homophone`(): Unit = runBlocking {
        // The reading alone names no word when several entries share it; taking them would hand a
        // kanji headword the meanings of different words.
        stub(
            "かける" to found(
                entry(headword = "掛ける", reading = "カケル", english = "to hang"),
                entry(headword = "賭ける", reading = "カケル", english = "to bet"),
            ),
        )

        val resolved = resolver.resolve(listOf(token("翔けて", "翔ける", "カケル"))).byTokenKey.values.single()

        assertThat(resolved.options).isEmpty()
    }

    @Test
    fun `a kanji honorific prefix is stripped before the lookup`(): Unit = runBlocking {
        // The dictionary has no entry for 御加減, but 加減 under the honorific 御 is an ordinary noun.
        stub(
            "加減" to found(
                DictionaryEntryDto(
                    headword = "加減",
                    reading = "カゲン",
                    senses = listOf(
                        DictionarySenseDto(
                            pos = listOf("Noun", "Suru verb"),
                            english = "condition, state of health",
                            englishDefinitions = listOf("condition", "state of health"),
                        ),
                    ),
                ),
            ),
        )
        val tokens = listOf(token("御加減", "御加減", "ゴカゲン", lineIndex = 15))

        val resolved = resolver.resolve(tokens).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("加減")
        assertThat(resolved.options.map { it.english }).containsExactly("condition, state of health")
        assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
    }

    @Test
    fun `a kana honorific prefix on a katakana noun is stripped and queried in hiragana`(): Unit = runBlocking {
        // お + katakana クスリ is 薬, which the stub answers only for a hiragana query.
        stub("くすり" to found(entry(headword = "薬", reading = "クスリ", english = "medicine")))
        val tokens = listOf(token("おクスリ", "おクスリ", "オクスリ", lineIndex = 19))

        val resolved = resolver.resolve(tokens).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("くすり")
        assertThat(resolved.options.map { it.english }).containsExactly("medicine")
        assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
    }

    @Test
    fun `a suru-verb passive handed back as the headword is rescued as stem plus suru`(): Unit = runBlocking {
        // 毒される has no dictionary entry; the reading ドクサレル is inflected back to ドクスル with the base form.
        stub(
            "毒する" to found(
                DictionaryEntryDto(
                    headword = "毒する",
                    reading = "ドクスル",
                    senses = listOf(
                        DictionarySenseDto(
                            pos = listOf("Suru verb - special class", "Transitive verb"),
                            english = "to poison",
                            englishDefinitions = listOf("to poison", "to corrupt"),
                        ),
                    ),
                ),
            ),
        )

        val tokens = listOf(token("毒されて", "毒される", "ドクサレル", lineIndex = 55))
        val resolved = resolver.resolve(tokens).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("毒する")
        assertThat(resolved.options.map { it.english }).containsExactly("to poison")
        assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
    }

    @Test
    fun `a verb stem with appearance sou is rescued as the verb's dictionary form`(): Unit = runBlocking {
        // 泣きそう has no dictionary entry; 泣き is 泣く's stem, so the probe turns its last i-row kana back to u-row.
        stub(
            "泣く" to found(
                DictionaryEntryDto(
                    headword = "泣く",
                    reading = "ナク",
                    senses = listOf(
                        DictionarySenseDto(
                            pos = listOf("Godan verb with 'ku' ending", "Intransitive verb"),
                            english = "to cry",
                            englishDefinitions = listOf("to cry", "to weep"),
                        ),
                    ),
                ),
            ),
        )
        val tokens = listOf(token("泣きそう", "泣きそう", "ナキソウ", lineIndex = 18))

        val resolved = resolver.resolve(tokens).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("泣く")
        assertThat(resolved.options.map { it.english }).containsExactly("to cry")
        assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
    }

    @Test
    fun `an i-adjective stem with appearance sou is rescued as the adjective`(): Unit = runBlocking {
        stub(
            "忙しい" to found(
                DictionaryEntryDto(
                    headword = "忙しい",
                    reading = "イソガシイ",
                    senses = listOf(
                        DictionarySenseDto(
                            pos = listOf("I-adjective (keiyoushi)"),
                            english = "busy",
                            englishDefinitions = listOf("busy"),
                        ),
                    ),
                ),
            ),
        )

        val resolved = resolver.resolve(
            listOf(token("忙しそう", "忙しそう", "イソガシソウ")),
        ).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("忙しい")
        assertThat(resolved.options.map { it.english }).containsExactly("busy")
        assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
    }

    @Test
    fun `a verb completed with kireru is looked up as the verb underneath`(): Unit = runBlocking {
        // 伝えきる is 伝える + completion きる; the dictionary has no entry for the compound.
        stub(
            "伝える" to found(
                DictionaryEntryDto(
                    headword = "伝える",
                    reading = "ツタエル",
                    senses = listOf(
                        DictionarySenseDto(
                            pos = listOf("Ichidan verb", "Transitive verb"),
                            english = "to convey",
                            englishDefinitions = listOf("to convey", "to tell"),
                        ),
                    ),
                ),
            ),
        )
        val tokens = listOf(token("伝えきれぬ", "伝えきる", "ツタエキレヌ", lineIndex = 28))

        val resolved = resolver.resolve(tokens).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("伝える")
        assertThat(resolved.options.map { it.english }).containsExactly("to convey")
        assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
    }

    @Test
    fun `a te-form verb followed by motion auxiliary iku is looked up as the bare verb`(): Unit = runBlocking {
        // 飛んでいく is the right headword but the dictionary has no entry for te-form + いく; the verb underneath is 飛ぶ.
        stub(
            "飛ぶ" to found(
                DictionaryEntryDto(
                    headword = "飛ぶ",
                    reading = "トブ",
                    senses = listOf(
                        DictionarySenseDto(
                            pos = listOf("Godan verb with 'bu' ending", "Intransitive verb"),
                            english = "to fly",
                            englishDefinitions = listOf("to fly", "to soar"),
                        ),
                    ),
                ),
            ),
        )
        val tokens = listOf(token("とんでけ", "飛んでいく", "トンデイク", lineIndex = 27))

        val resolved = resolver.resolve(tokens).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("飛ぶ")
        assertThat(resolved.options.map { it.english }).containsExactly("to fly")
        assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
    }

    @Test
    fun `an ichidan te-form followed by kuru is looked up as the ru verb`(): Unit = runBlocking {
        stub(
            "消える" to found(
                DictionaryEntryDto(
                    headword = "消える",
                    reading = "キエル",
                    senses = listOf(
                        DictionarySenseDto(
                            pos = listOf("Ichidan verb", "Intransitive verb"),
                            english = "to disappear",
                            englishDefinitions = listOf("to disappear"),
                        ),
                    ),
                ),
            ),
        )

        val resolved = resolver.resolve(
            listOf(token("消えてきた", "消えてくる", "キエテクル")),
        ).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("消える")
        assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
    }

    @Test
    fun `a negative verb handed back as the headword is rescued as its dictionary form`(): Unit = runBlocking {
        // The negative いらない was given as the headword for いらん; the dictionary indexes only 要る.
        stub(
            "いる" to found(
                DictionaryEntryDto(
                    headword = "要る",
                    reading = "イル",
                    senses = listOf(
                        DictionarySenseDto(
                            pos = listOf("Godan verb with 'ru' ending", "Intransitive verb"),
                            english = "to be needed",
                            englishDefinitions = listOf("to be needed"),
                        ),
                    ),
                ),
            ),
        )
        val tokens = listOf(token("いらん", "いらない", "イラナイ", lineIndex = 25))

        val resolved = resolver.resolve(tokens).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("いる")
        assertThat(resolved.options.map { it.headword }).containsExactly("要る")
        assertThat(resolved.options.map { it.english }).containsExactly("to be needed")
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
    }

    @Test
    fun `a potential verb the dictionary lists as its own headword is looked up as the godan verb`(): Unit = runBlocking {
        stub(
            "眠れる" to found(
                DictionaryEntryDto(
                    headword = "眠れる",
                    reading = "ネムレル",
                    senses = listOf(
                        DictionarySenseDto(
                            pos = listOf("Pre-noun adjectival (rentaishi)"),
                            english = "sleeping / asleep",
                            englishDefinitions = listOf("sleeping", "asleep"),
                        ),
                        DictionarySenseDto(
                            pos = listOf("Ichidan verb", "Intransitive verb"),
                            english = "to be able to sleep",
                            englishDefinitions = listOf("to be able to sleep"),
                        ),
                    ),
                ),
            ),
            "眠る" to found(godanVerb("眠る", "ネムル", "to sleep")),
        )

        val resolved = resolver.resolve(listOf(token("眠れ", "眠れる", "ネムレル"))).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("眠る")
        assertThat(resolved.options.map { it.english }).containsExactly("to sleep")
    }

    @Test
    fun `a potential-looking verb with a meaning of its own keeps its entry`(): Unit = runBlocking {
        stub(
            "行ける" to found(
                DictionaryEntryDto(
                    headword = "行ける",
                    reading = "イケル",
                    senses = listOf(
                        DictionarySenseDto(
                            pos = listOf("Ichidan verb", "Intransitive verb"),
                            english = "to be able to go",
                            englishDefinitions = listOf("to be able to go"),
                        ),
                        DictionarySenseDto(
                            pos = listOf("Ichidan verb", "Intransitive verb"),
                            english = "to be good / to be passable",
                            englishDefinitions = listOf("to be good", "to be passable"),
                        ),
                    ),
                ),
            ),
            "行く" to found(godanVerb("行く", "イク", "to go")),
        )

        val resolved = resolver.resolve(listOf(token("行ける", "行ける", "イケル"))).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("行ける")
    }

    @Test
    fun `a negative-form probe that lands on a non-verb is not accepted`(): Unit = runBlocking {
        // 少ない is an adjective; the probe asks for 少る, and a noun answering it must not be taken.
        stub("少る" to found(entry(headword = "少る", reading = "スクル", english = "noun")))

        val resolved = resolver.resolve(listOf(token("少ない", "少ない", "スクナイ"))).byTokenKey.values.single()

        assertThat(resolved.options).isEmpty()
    }

    @Test
    fun `a potential-form headword is looked up as its godan dictionary form`(): Unit = runBlocking {
        // The potential 掴める was given as the headword; the dictionary has no entry for it. 掴む is the verb underneath.
        stub(
            "掴む" to found(
                DictionaryEntryDto(
                    headword = "掴む",
                    reading = "ツカム",
                    senses = listOf(
                        DictionarySenseDto(
                            pos = listOf("Godan verb with 'mu' ending", "Transitive verb"),
                            english = "to seize, to grasp",
                            englishDefinitions = listOf("to seize", "to grasp"),
                        ),
                    ),
                ),
            ),
        )
        val tokens = listOf(token("掴めなくて", "掴める", "ツカメル", lineIndex = 16))

        val resolved = resolver.resolve(tokens).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("掴む")
        assertThat(resolved.options.map { it.english }).containsExactly("to seize, to grasp")
        assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
    }

    @Test
    fun `a potential-form headword with no godan verb underneath stays unresolved`(): Unit = runBlocking {
        stub()
        val tokens = listOf(token("掴めなくて", "掴める", "ツカメル", lineIndex = 16))

        val resolved = resolver.resolve(tokens).byTokenKey.values.single()

        assertThat(resolved.options).isEmpty()
        assertThat(resolver.unresolvedTokens(tokens).map { it.token.headword }).containsExactly("掴める")
    }

    @Test
    fun `a godan verb's renyokei handed back as the headword is restored to its dictionary form`(): Unit =
        runBlocking {
            // 悼み is the renyokei of 悼む and the dictionary has no entry for it.
            stub(
                "悼む" to found(
                    DictionaryEntryDto(
                        headword = "悼む",
                        reading = "イタム",
                        senses = listOf(
                            DictionarySenseDto(
                                pos = listOf("Godan verb with 'mu' ending", "Transitive verb"),
                                english = "to grieve over",
                                englishDefinitions = listOf("to grieve over", "to mourn", "to lament"),
                            ),
                        ),
                    ),
                ),
            )
            val tokens = listOf(token("悼み", "悼み", "イタミ"))

            val resolved = resolver.resolve(tokens).byTokenKey.values.single()

            assertThat(resolved.baseForm).isEqualTo("悼む")
            assertThat(resolved.options.map { it.english }).containsExactly("to grieve over")
            assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
            assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
        }

    @Test
    fun `a godan verb's potential negative handed back as the headword is rescued as the verb`(): Unit = runBlocking {
        // The dictionary has no entry for 飛べない, but 飛べ is the potential stem of 飛ぶ.
        stub(
            "飛ぶ" to found(
                DictionaryEntryDto(
                    headword = "飛ぶ",
                    reading = "トブ",
                    senses = listOf(
                        DictionarySenseDto(
                            pos = listOf("Godan verb with 'bu' ending", "Intransitive verb"),
                            english = "to fly",
                            englishDefinitions = listOf("to fly", "to soar"),
                        ),
                    ),
                ),
            ),
        )
        val tokens = listOf(token("飛べない", "飛べない", "トベナイ", lineIndex = 31))

        val resolved = resolver.resolve(tokens).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("飛ぶ")
        assertThat(resolved.options.map { it.english }).containsExactly("to fly")
        assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
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

    @Test
    fun `a te-form verb followed by progressive iru or its contraction is looked up as the bare verb`(): Unit = runBlocking {
        stub(
            "書く" to found(godanVerb("書く", "カク", "to write")),
            "わかる" to found(godanVerb("分かる", "ワカル", "to understand")),
            "見る" to found(posEntry("見る", "ミル", "to see", "Ichidan verb", "Transitive verb")),
        )
        val tokens = listOf(
            token("書いてる", "書いている", "カイテイル", lineIndex = 1),
            token("わかってる", "わかってる", "ワカッテル", lineIndex = 2),
            token("みちゃって", "見てしまう", "ミテシマウ", lineIndex = 3),
        )

        val resolved = resolver.resolve(tokens).byTokenKey.values

        assertThat(resolved.map { it.baseForm }).containsExactly("書く", "わかる", "見る")
        assertThat(resolved.map { it.options.single().provenance }).containsOnly(DictionaryLookupProvenance.EXACT)
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
    }

    @Test
    fun `a passive te-form followed by progressive iru is looked up as the active verb`(): Unit = runBlocking {
        stub("照らす" to found(godanVerb("照らす", "テラス", "to shine on")))
        val tokens = listOf(token("照らされている", "照らされている", "テラサレテイル"))

        val resolved = resolver.resolve(tokens).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("照らす")
        assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
    }

    @Test
    fun `kuru and iru themselves are never cut as a te-form auxiliary`(): Unit = runBlocking {
        // Nothing but the cut-down stems answers, so any rescue here would have cut the verb itself.
        stub("く" to found(godanVerb("来", "ク", "wrong")), "い" to found(godanVerb("居", "イ", "wrong")))

        val resolved = resolver.resolve(
            listOf(token("くる", "くる", "クル", lineIndex = 1), token("いる", "いる", "イル", lineIndex = 2)),
        ).byTokenKey.values

        assertThat(resolved.flatMap { it.options }).isEmpty()
    }

    @Test
    fun `a causative handed back as the headword is rescued as the verb underneath`(): Unit = runBlocking {
        stub(
            "振り向く" to found(godanVerb("振り向く", "フリムク", "to turn around")),
            "うずく" to found(godanVerb("疼く", "ウズク", "to throb")),
            "咲く" to found(godanVerb("咲く", "サク", "to bloom")),
            "食べる" to found(posEntry("食べる", "タベル", "to eat", "Ichidan verb", "Transitive verb")),
        )
        val tokens = listOf(
            token("振り向かせ", "振り向かせる", "フリムカセル", lineIndex = 1),
            token("うずかせ", "うずかせる", "ウズカセル", lineIndex = 2),
            token("咲かせ", "咲かす", "サカス", lineIndex = 3),
            token("食べさせ", "食べさせる", "タベサセル", lineIndex = 4),
        )

        val resolved = resolver.resolve(tokens).byTokenKey.values

        assertThat(resolved.map { it.baseForm }).containsExactly("振り向く", "うずく", "咲く", "食べる")
        assertThat(resolved.map { it.options.single().provenance }).containsOnly(DictionaryLookupProvenance.EXACT)
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
    }

    @Test
    fun `a causative probe that lands on a non-verb is not accepted`(): Unit = runBlocking {
        stub("灯く" to found(entry(headword = "灯く", reading = "トク", english = "noun homograph")))

        val resolved = resolver.resolve(listOf(token("灯かせる", "灯かせる", "トカセル"))).byTokenKey.values.single()

        assertThat(resolved.options).isEmpty()
    }

    @Test
    fun `a verb's desiderative is restored to the dictionary form`(): Unit = runBlocking {
        stub(
            "やる" to found(godanVerb("遣る", "ヤル", "to do")),
            "知る" to found(godanVerb("知る", "シル", "to know")),
        )
        val tokens = listOf(
            token("やりたい", "やりたい", "ヤリタイ", lineIndex = 1),
            token("知りたがる", "知りたがる", "シリタガル", lineIndex = 2),
        )

        val resolved = resolver.resolve(tokens).byTokenKey.values

        assertThat(resolved.map { it.baseForm }).containsExactly("やる", "知る")
        assertThat(resolved.map { it.options.single().english }).containsExactly("to do", "to know")
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
    }

    @Test
    fun `an ichidan desiderative is not taken for the archaic verb its stem also spells`(): Unit = runBlocking {
        // 生きたい probes the godan guess 生く first; the dictionary has it only as an archaic yodan verb.
        stub(
            "生く" to found(posEntry("生く", "イク", "to live (archaic)", "Yodan verb with 'ku' ending (archaic)")),
            "生きる" to found(posEntry("生きる", "イキル", "to live", "Ichidan verb", "Intransitive verb")),
        )

        val resolved = resolver.resolve(listOf(token("生きたくない", "生きたくない", "イキタクナイ"))).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("生きる")
        assertThat(resolved.options.map { it.english }).containsExactly("to live")
    }

    @Test
    fun `an ichidan volitional handed back as the headword is looked up as the ru verb`(): Unit = runBlocking {
        stub(
            "化ける" to found(
                posEntry("化ける", "フケル", "to age", "Ichidan verb"),
                posEntry("化ける", "バケル", "to take the form of", "Ichidan verb"),
            ),
        )
        val tokens = listOf(token("化けよう", "化けよう", "バケヨウ"))

        val resolved = resolver.resolve(tokens).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("化ける")
        assertThat(resolved.options.map { it.english }).containsExactly("to take the form of")
        assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
    }

    @Test
    fun `a na-adjective handed back in its attributive form is looked up as the stem`(): Unit = runBlocking {
        stub(
            "嫌" to found(posEntry("嫌", "イヤ", "disliking", "Na-adjective (keiyodoshi)")),
            "新た" to found(posEntry("新た", "アラタ", "new", "Na-adjective (keiyodoshi)")),
        )
        val tokens = listOf(
            token("やな", "嫌な", "イヤナ", lineIndex = 1),
            token("新たな", "新たな", "アラタナ", lineIndex = 2),
        )

        val resolved = resolver.resolve(tokens).byTokenKey.values

        assertThat(resolved.map { it.baseForm }).containsExactly("嫌", "新た")
        assertThat(resolved.map { it.options.single().provenance }).containsOnly(DictionaryLookupProvenance.EXACT)
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
    }

    @Test
    fun `a na-adjective handed back in its da dictionary form is looked up as the stem`(): Unit = runBlocking {
        // 幼気な手のひら、同じになれなくても。
        stub("幼気" to found(posEntry("幼気", "イタイケ", "innocent", "Na-adjective (keiyodoshi)")))
        val tokens = listOf(token("幼気な", "幼気だ", "イタイケダ"))

        val resolved = resolver.resolve(tokens).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("幼気")
        assertThat(resolved.options.single().provenance).isEqualTo(DictionaryLookupProvenance.EXACT)
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
    }

    @Test
    fun `a prohibitive na or a plain noun stem is not taken for a na-adjective`(): Unit = runBlocking {
        stub(
            "行く" to found(godanVerb("行く", "イク", "to go")),
            "や" to found(entry(headword = "矢", reading = "ヤ", english = "arrow")),
        )

        val resolved = resolver.resolve(
            listOf(token("行くな", "行くな", "イクナ", lineIndex = 1), token("やな", "やな", "ヤナ", lineIndex = 2)),
        ).byTokenKey.values

        assertThat(resolved.flatMap { it.options }).isEmpty()
    }

    @Test
    fun `an interjection cut short with a trailing small tsu is queried again without it`(): Unit = runBlocking {
        stub(
            "えい" to found(
                entry(headword = "英", reading = "エイ", english = "Britain"),
                posEntry(null, "エイ", "hyah!", "Interjection"),
            ),
        )
        val tokens = listOf(token("えいっ", "えいっ", "エイッ"))

        val resolved = resolver.resolve(tokens).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("えい")
        assertThat(resolved.options.map { it.english }).containsExactly("hyah!")
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
    }

    @Test
    fun `a trailing small tsu probe with only non-interjection homophones stays unresolved`(): Unit = runBlocking {
        stub("えい" to found(entry(headword = "英", reading = "エイ", english = "Britain")))

        val resolved = resolver.resolve(listOf(token("えいっ", "えいっ", "エイッ"))).byTokenKey.values.single()

        assertThat(resolved.options).isEmpty()
    }

    @Test
    fun `a headword written with Kangxi radical characters is looked up in its ordinary kanji`(): Unit = runBlocking {
        stub(
            "手放す" to found(godanVerb("手放す", "テバナス", "to let go of")),
            "食う" to found(godanVerb("食う", "クウ", "to eat")),
        )
        // The first goes on through the desiderative rescue after the fold.
        val tokens = listOf(
            token("⼿放したくない", "⼿放したくない", "テバナシタクナイ", lineIndex = 1),
            token("⾷って", "⾷う", "クウ", lineIndex = 2),
        )

        val resolved = resolver.resolve(tokens).byTokenKey.values

        assertThat(resolved.map { it.baseForm }).containsExactly("手放す", "食う")
        assertThat(resolved.map { it.options.single().provenance }).containsOnly(DictionaryLookupProvenance.EXACT)
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
    }

    @Test
    fun `verbs written with the variant kanji 堕 and 搔 are looked up as 落 and 掻`(): Unit = runBlocking {
        stub(
            "産み落とす" to found(godanVerb("産み落とす", "ウミオトス", "to give birth to")),
            "掻く" to found(godanVerb("掻く", "カク", "to scratch")),
        )
        val tokens = listOf(
            token("産み堕として", "産み堕とす", "ウミオトス", lineIndex = 1),
            token("搔き", "搔く", "カク", lineIndex = 2),
        )

        val resolved = resolver.resolve(tokens).byTokenKey.values

        assertThat(resolved.map { it.baseForm }).containsExactly("産み落とす", "掻く")
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
    }

    @Test
    fun `a kanji numeral glued to its counter is looked up as the counter`(): Unit = runBlocking {
        stub(
            "年" to found(
                posEntry("年", "トセ", "counter for years", "Counter"),
                posEntry("年", "トシ", "year", "Noun"),
                posEntry("年", "ネン", "year", "Noun"),
            ),
            "回目" to found(posEntry("回目", "カイメ", "nth time", "Suffix")),
        )
        val tokens = listOf(
            token("二年", "二年", "ニネン", lineIndex = 1),
            token("何回目", "何回目", "ナンカイメ", lineIndex = 2),
        )

        val resolved = resolver.resolve(tokens).byTokenKey.values

        assertThat(resolved.map { it.baseForm }).containsExactly("年", "回目")
        assertThat(resolved.map { it.options.single().reading }).containsExactly("ネン", "カイメ")
        assertThat(resolved.map { it.options.single().provenance }).containsOnly(DictionaryLookupProvenance.EXACT)
        assertThat(resolver.unresolvedTokens(tokens)).isEmpty()
    }

    @Test
    fun `a numeral followed by kana is not cut as a counter`(): Unit = runBlocking {
        stub("も" to found(posEntry(null, "モ", "too", "Noun")))

        val resolved = resolver.resolve(listOf(token("何も", "何も", "ナニモ"))).byTokenKey.values.single()

        assertThat(resolved.options).isEmpty()
    }

    @Test
    fun `a kana negative that only matched a kanji homophone is read as the negative verb`(): Unit = runBlocking {
        // いない's only entry is 以内 (within), reached through its reading; the lyric means "is not there".
        stub(
            "いない" to found(entry(headword = "以内", reading = "イナイ", english = "within")),
            "いる" to found(posEntry("居る", "イル", "to be", "Ichidan verb", "Intransitive verb")),
        )

        val resolved = resolver.resolve(listOf(token("いない", "いない", "イナイ"))).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("いる")
        assertThat(resolved.options.map { it.english }).containsExactly("to be")
    }

    @Test
    fun `a kana adjective in nai keeps its kanji entry when no verb underlies it`(): Unit = runBlocking {
        stub(
            "すくない" to found(posEntry("少ない", "スクナイ", "few", "I-adjective (keiyoushi)")),
            "すくる" to found(entry(headword = "掬る", reading = "スクル", english = "noun homograph")),
        )

        val resolved = resolver.resolve(listOf(token("すくない", "すくない", "スクナイ"))).byTokenKey.values.single()

        assertThat(resolved.baseForm).isEqualTo("すくない")
        assertThat(resolved.options.map { it.english }).containsExactly("few")
    }

    @Test
    fun `a kana adjective in nai is not read as a negative even when a verb matches its stem`(): Unit = runBlocking {
        // はかない is 儚い; はく (吐く "to vomit") must not take over.
        stub(
            "はかない" to found(posEntry("儚い", "ハカナイ", "fleeting", "I-adjective (keiyoushi)")),
            "はく" to found(posEntry("吐く", "ハク", "to vomit", "Godan verb with 'ku' ending")),
        )

        val resolved = resolver.resolve(listOf(token("はかない", "はかない", "ハカナイ"))).byTokenKey.values.single()

        assertThat(resolved.options.map { it.english }).containsExactly("fleeting")
    }

    @Test
    fun `an archaic kana word keeps its only kanji entry even if the corpus never saw it`(): Unit = runBlocking {
        stub("たまゆら" to found(entry(headword = "玉響", reading = "タマユラ", english = "a moment").copy(seenInCorpus = false)))

        val resolved = resolver.resolve(listOf(token("たまゆら", "たまゆら", "タマユラ"))).byTokenKey.values.single()

        assertThat(resolved.options.map { it.english }).containsExactly("a moment")
    }

    @Test
    fun `a kana headword does not adopt a kanji entry the corpus never saw`(): Unit = runBlocking {
        // うちに is うち + に glued; its only match, 打ち荷 (jettisoned cargo), never appears in running text.
        stub("うちに" to found(entry(headword = "打ち荷", reading = "ウチニ", english = "jettisoned cargo").copy(seenInCorpus = false)))

        val resolved = resolver.resolve(listOf(token("うちに", "うちに", "ウチニ"))).byTokenKey.values.single()

        assertThat(resolved.options).isEmpty()
    }

    private fun posEntry(headword: String?, reading: String, english: String, vararg pos: String) = DictionaryEntryDto(
        headword = headword,
        reading = reading,
        senses = listOf(DictionarySenseDto(pos = pos.toList(), english = english, englishDefinitions = listOf(english))),
    )

    private fun stub(vararg entries: Pair<String, DictionaryLookupDto>) {
        val byWord = entries.toMap()
        coEvery { dictionaryService.lookupAll(any()) } answers {
            firstArg<List<String>>().associateWith { byWord[it] ?: DictionaryLookupDto(found = false, word = it) }
        }
    }

    /** 前 answers with 前[ゼン], 前[マエ], and — via the 先 entry's alternate spelling — 先[サキ]. */
    private fun maeAndZenAndSaki() = found(
        entry(headword = "前", reading = "ゼン", english = "previous, before", jlpt = listOf("jlpt-n1")),
        entry(headword = "前", reading = "マエ", english = "before / earlier", jlpt = listOf("jlpt-n5")),
        entry(headword = "先", reading = "サキ", english = "ahead, previous"),
    )

    private fun found(vararg entries: DictionaryEntryDto) = DictionaryLookupDto(
        found = true,
        word = entries.first().headword ?: entries.first().reading.orEmpty(),
        entries = entries.toList(),
        provenance = DictionaryLookupProvenance.EXACT,
    )

    private fun entry(
        headword: String?,
        reading: String,
        english: String,
        jlpt: List<String> = emptyList(),
    ) = DictionaryEntryDto(
        headword = headword,
        reading = reading,
        jlpt = jlpt,
        senses = listOf(
            DictionarySenseDto(pos = listOf("Noun"), english = english, englishDefinitions = listOf(english)),
        ),
    )

    private fun godanVerb(headword: String, reading: String, english: String) = DictionaryEntryDto(
        headword = headword,
        reading = reading,
        senses = listOf(
            DictionarySenseDto(
                pos = listOf("Godan verb with '${reading.last()}' ending", "Intransitive verb"),
                english = english,
                englishDefinitions = listOf(english),
            ),
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
