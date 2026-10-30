package com.japanese.vocabulary.translation.service.pipeline

import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.translation.model.PipelineToken
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class RuleMeaningProviderTest {
    private val provider = RuleMeaningProvider()

    @Test
    fun `resolves teiru and teru as auxiliary ongoing action`() {
        assertThat(provider.resolve(token("ている"))!!.partOfSpeech).isEqualTo(PartOfSpeech.AUXILIARY_VERB)
        assertThat(provider.resolve(token("てる"))!!.koreanText).isEqualTo("~하고 있다")
    }

    @Test
    fun `resolves archaic manima in no-manima-ni`() {
        // 浮世の随に — 随 comes out as its own token with に split off, and the dictionary has no entry for it.
        val resolved = provider.resolve(PipelineToken(7, "随", "随", 3, 4))!!

        assertThat(resolved.baseForm).isEqualTo("随")
        assertThat(resolved.reading).isEqualTo("マニマ")
        assertThat(resolved.koreanText).contains("대로")
    }

    @Test
    fun `resolves teshimau headword behind a colloquial contracted surface`() {
        // 当然の報いにクラっちゃった — segmentation already normalises っちゃった to the headword
        // てしまう, so the rule must key on the headword and not require the surface to match.
        val resolved = provider.resolve(PipelineToken(40, "っちゃった", "てしまう", 8, 13))!!

        assertThat(resolved.partOfSpeech).isEqualTo(PartOfSpeech.AUXILIARY_VERB)
        assertThat(resolved.baseForm).isEqualTo("てしまう")
        assertThat(resolved.baseFormReading).isEqualTo("テシマウ")
        assertThat(resolved.koreanText).isEqualTo("~해 버리다")
    }

    @Test
    fun `resolves teoku headword behind a colloquial contracted surface`() {
        // ただ泣きたくて 図っといて 集めちゃった感情参考書です — segmentation normalises といて to
        // the headword ておく, which the dictionary has no entry for.
        val resolved = provider.resolve(PipelineToken(34, "といて", "ておく", 10, 13))!!

        assertThat(resolved.partOfSpeech).isEqualTo(PartOfSpeech.AUXILIARY_VERB)
        assertThat(resolved.baseForm).isEqualTo("ておく")
        assertThat(resolved.baseFormReading).isEqualTo("テオク")
        assertThat(resolved.koreanText).isEqualTo("~해 두다")
    }

    @Test
    fun `resolves conditional reba including its colloquial rya contraction`() {
        // 「無意味を集めりゃ意味になる」: segmentation splits 集めりゃ into 集め + りゃ(headword れば).
        // れば is a conjugation ending, not a dictionary headword, so the dictionary cannot answer it.
        val contracted = provider.resolve(PipelineToken(24, "りゃ", "れば", 7, 9, usedReading = "リャ"))!!

        assertThat(contracted.partOfSpeech).isEqualTo(PartOfSpeech.AUXILIARY_VERB)
        assertThat(contracted.baseForm).isEqualTo("れば")
        assertThat(contracted.koreanText).isNotBlank()

        assertThat(provider.resolve(token("れば"))!!.koreanText).isEqualTo(contracted.koreanText)
    }

    @Test
    fun `resolves particles`() {
        val resolved = provider.resolve(token("も"))!!

        assertThat(resolved.partOfSpeech).isEqualTo(PartOfSpeech.PARTICLE)
        assertThat(resolved.koreanText).isEqualTo("~도")
    }

    @Test
    fun `de after nai is the negative request, not the location particle`() {
        // 取り残さないでよ
        val nai = PipelineToken(11, "ない", "ない", 4, 6)
        val de = PipelineToken(11, "で", "で", 6, 7, contextGloss = "and")

        assertThat(provider.resolve(de, nai)!!.koreanText).isEqualTo("~하지 말고")
    }

    @Test
    fun `de after a voiced godan te stem is the connective`() {
        // 盗んででも: the model glossed this で "by means of"; the stem says te-form.
        val stem = PipelineToken(51, "盗ん", "盗む", 0, 2)
        val de = PipelineToken(51, "で", "で", 2, 3, contextGloss = "by means of")

        assertThat(provider.resolve(de, stem)!!.koreanText).isEqualTo("~하고")
    }

    @Test
    fun `de takes its meaning from the context gloss after a noun`() {
        val wing = PipelineToken(14, "羽", "羽", 0, 1)

        assertThat(provider.resolve(PipelineToken(14, "で", "で", 1, 2, contextGloss = "with, by"), wing)!!.koreanText)
            .isEqualTo("~로")
        assertThat(provider.resolve(PipelineToken(14, "で", "で", 1, 2, contextGloss = "at, in"), wing)!!.koreanText)
            .isEqualTo("~에서")
        assertThat(provider.resolve(PipelineToken(14, "で", "で", 1, 2), wing)!!.koreanText).isEqualTo("~에서")
        assertThat(provider.resolve(PipelineToken(14, "で", "で", 1, 2, contextGloss = "at, in, with"), wing)!!.koreanText)
            .isEqualTo("~에서")
    }

    @Test
    fun `to and no take their non-default function from the context gloss`() {
        assertThat(provider.resolve(token("と").copy(contextGloss = "quotative particle"))!!.koreanText)
            .isEqualTo("~라고")
        assertThat(provider.resolve(token("と").copy(contextGloss = "when"))!!.koreanText).isEqualTo("~하면")
        assertThat(provider.resolve(token("と").copy(contextGloss = "with"))!!.koreanText).isEqualTo("~와/과")
        assertThat(provider.resolve(token("の").copy(contextGloss = "nominalizer"))!!.koreanText).isEqualTo("~것")
        assertThat(provider.resolve(token("の").copy(contextGloss = "possessive particle"))!!.koreanText)
            .isEqualTo("~의")
    }

    @Test
    fun `n tte and ja resolve only under their grammatical headwords`() {
        val n = provider.resolve(PipelineToken(4, "ん", "の", 3, 4))!!
        assertThat(n.koreanText).isEqualTo("~거야")
        assertThat(n.reading).isEqualTo("ン")
        // 僕ん家
        assertThat(provider.resolve(PipelineToken(4, "ん", "の", 1, 2, contextGloss = "possessive"))!!.koreanText)
            .isEqualTo("~의")
        assertThat(provider.resolve(PipelineToken(4, "って", "って", 3, 5))!!.koreanText).isEqualTo("~라고")
        assertThat(provider.resolve(PipelineToken(4, "じゃ", "では", 3, 4))!!.koreanText).isEqualTo("~이/가")
        assertThat(provider.resolve(PipelineToken(4, "じゃ", "では", 0, 1, contextGloss = "if so"))!!.koreanText)
            .isEqualTo("그럼")

        // 知らん: negative ぬ. 死んじゃ: contracted てしまう is the auxiliary entry, not じゃ.
        assertThat(provider.resolve(PipelineToken(4, "ん", "ぬ", 2, 3))).isNull()
        assertThat(provider.resolve(PipelineToken(4, "じゃ", "てしまう", 2, 3))!!.koreanText).isEqualTo("~해 버리다")
    }

    @Test
    fun `resolves colloquial and literary spellings the dictionary lacks, one meaning each`() {
        val cases = listOf(
            PipelineToken(0, "あゝ", "あゝ", 0, 2) to "아아",
            PipelineToken(0, "もんだ", "ものだ", 0, 3) to "~하는 법이다",
            PipelineToken(0, "なんていう", "何て言う", 0, 5) to "무슨",
            PipelineToken(0, "やんなっちゃう", "やになる", 0, 7) to "싫어지다",
            PipelineToken(0, "している", "している", 0, 4) to "~하고 있다",
        )
        cases.forEach { (token, meaning) ->
            val resolved = provider.resolve(token)!!
            assertThat(resolved.koreanText).isEqualTo(meaning)
            assertThat(resolved.koreanText).doesNotContain(",")
        }
    }

    @Test
    fun `rewrites kounimo and yanamono into the pieces the dictionary and rules know`() {
        val kounimo = provider.rewrite(listOf(PipelineToken(3, "こうにも", "こうにも", 4, 8)))
        assertThat(kounimo.map { it.surface }).containsExactly("こう", "に", "も")
        assertThat(kounimo.map { it.charStart }).containsExactly(4, 6, 7)

        val yanamono = provider.rewrite(listOf(PipelineToken(3, "やなもの", "嫌な物", 0, 4)))
        assertThat(yanamono.map { it.surface }).containsExactly("やな", "もの")
        assertThat(provider.resolve(yanamono.first())!!.koreanText).isEqualTo("싫은")
    }

    @Test
    fun `resolves glued dakede as a single particle`() {
        // 嫌になんだよ お前を見ただけで — segmentation emits だけで as surface and headword, so
        // GluedParticleSplitter has nothing to split and the dictionary has no entry for the glued form.
        val resolved = provider.resolve(PipelineToken(33, "だけで", "だけで", 11, 14))!!

        assertThat(resolved.partOfSpeech).isEqualTo(PartOfSpeech.PARTICLE)
        assertThat(resolved.baseFormReading).isEqualTo("ダケデ")
        assertThat(resolved.koreanText).isNotBlank()
    }

    @Test
    fun `resolves conditional tara and its voiced dara form`() {
        // 声聞かせて その手掴んだら離さないから — segmentation emits だら on its own, and the dictionary has no
        // entry for the た+ら suffix, so it has to be settled by rule like た and だ are.
        val dara = provider.resolve(PipelineToken(1, "だら", "だら", 9, 11))!!

        assertThat(dara.partOfSpeech).isEqualTo(PartOfSpeech.AUXILIARY_VERB)
        assertThat(dara.baseFormReading).isEqualTo("ダラ")
        assertThat(dara.koreanText).isEqualTo("~하면")
        assertThat(provider.resolve(token("たら"))!!.koreanText).isEqualTo("~하면")
    }

    @Test
    fun `resolves shiteiku glued after a suru-noun as auxiliary teiku`() {
        // 頭ん中ぎゅるんぎゅるん回転していく — segmentation emits していく as surface and headword
        // after 回転, and the dictionary has no entry for the する + ていく chain.
        val resolved = provider.resolve(PipelineToken(5, "していく", "していく", 13, 17))!!

        assertThat(resolved.partOfSpeech).isEqualTo(PartOfSpeech.AUXILIARY_VERB)
        assertThat(resolved.baseFormReading).isEqualTo("シテイク")
        assertThat(resolved.koreanText).isEqualTo("~해 가다")
        assertThat(provider.resolve(token("ていく"))!!.koreanText).isEqualTo("~해 가다")
    }

    @Test
    fun `resolves colloquial concessive ttatte behind a mistaken toittatte headword`() {
        // 宙に舞ったったってその因果も — segmentation emits ったって with the headword といったって,
        // which the dictionary has no entry for, so the concessive suffix must be settled by rule.
        val resolved = provider.resolve(PipelineToken(71, "ったって", "といったって", 5, 9))

        assertThat(resolved).isNotNull
        assertThat(resolved!!.partOfSpeech).isEqualTo(PartOfSpeech.AUXILIARY_VERB)
        assertThat(resolved.baseForm).isEqualTo("ったって")
        assertThat(resolved.koreanText).isEqualTo("~해도")
        assertThat(provider.resolve(token("たって"))!!.koreanText).isEqualTo("~해도")
    }

    @Test
    fun `resolves colloquial yada contraction of iyada`() {
        // ああもうやだ 間違えたら正しさの先まで — segmentation writes the headword as 嫌だ, which the dictionary
        // has no entry for, and the やだ surface is the contraction itself.
        val resolved = provider.resolve(PipelineToken(4, "やだ", "嫌だ", 4, 6))!!

        assertThat(resolved.partOfSpeech).isEqualTo(PartOfSpeech.NA_ADJECTIVE)
        assertThat(resolved.baseForm).isEqualTo("嫌だ")
        assertThat(resolved.reading).isEqualTo("ヤダ")
        assertThat(resolved.baseFormReading).isEqualTo("イヤダ")
        assertThat(resolved.koreanText).isNotBlank()
    }

    @Test
    fun `does not rule-resolve ambiguous grammar-like words`() {
        assertThat(provider.resolve(token("ない"))).isNull()
        assertThat(provider.resolve(token("から"))).isNull()
    }

    @Test
    fun `resolves doushite and ikagashite spelling as why`() {
        val resolved = provider.resolve(token("如何して"))!!

        assertThat(resolved.baseForm).isEqualTo("どうして")
        assertThat(resolved.partOfSpeech).isEqualTo(PartOfSpeech.ADVERB)
        assertThat(resolved.koreanText).contains("왜")
    }

    @Test
    fun `resolves colloquial mettara from yatara mettara`() {
        // なんでもかんでもやたらめったら性癖フェティシズム — めったら is a colloquial stretch of 滅多
        // with no dictionary headword, so it was reported as a dictionary miss.
        val resolved = provider.resolve(PipelineToken(28, "めったら", "めったら", 11, 15))!!

        assertThat(resolved.partOfSpeech).isEqualTo(PartOfSpeech.ADVERB)
        assertThat(resolved.reading).isEqualTo("メッタラ")
        assertThat(resolved.koreanText).isNotBlank()
    }

    @Test
    fun `resolves glued tame ni as purpose expression`() {
        // 誰かに望まれた色を探し見つけるために歩いてきた — ために comes back as one token, and the
        // dictionary has it only under 為.
        val resolved = provider.resolve(PipelineToken(12, "ために", "ために", 15, 18))

        assertThat(resolved).isNotNull
        assertThat(resolved!!.partOfSpeech).isEqualTo(PartOfSpeech.EXPRESSION)
        assertThat(resolved.reading).isEqualTo("タメニ")
        assertThat(resolved.koreanText).isEqualTo("~하기 위해")
    }

    @Test
    fun `rewrites doumo koumo pair into deterministic smaller tokens`() {
        val rewritten = provider.rewrite(
            listOf(
                PipelineToken(0, "どうも", "どうも", 0, 3),
                PipelineToken(0, "こうも", "こうも", 3, 6),
            ),
        )

        assertThat(rewritten.map { it.surface }).containsExactly("どう", "も", "こう", "も")
        assertThat(rewritten.map { it.charStart to it.charEnd }).containsExactly(0 to 2, 2 to 3, 3 to 5, 5 to 6)
    }

    @Test
    fun `rewrites konnanimo into adverb and particle`() {
        // ただこんなにも君とリンクしてる — the model emits こんなにも as surface *and* headword, so
        // GluedParticleSplitter sees no mismatch and the dictionary has no entry for the glued form.
        val rewritten = provider.rewrite(
            listOf(
                PipelineToken(42, "ただ", "ただ", 0, 2),
                PipelineToken(42, "こんなにも", "こんなにも", 2, 7),
                PipelineToken(42, "君", "君", 7, 8),
            ),
        )

        assertThat(rewritten.map { it.surface }).containsExactly("ただ", "こんなに", "も", "君")
        assertThat(rewritten.map { it.headword }).containsExactly("ただ", "こんなに", "も", "君")
        assertThat(rewritten.map { it.charStart to it.charEnd })
            .containsExactly(0 to 2, 2 to 6, 6 to 7, 7 to 8)
        assertThat(provider.resolve(rewritten[2])!!.partOfSpeech).isEqualTo(PartOfSpeech.PARTICLE)
    }

    @Test
    fun `rewrites locative made phrases into location and particle`() {
        val rewritten = provider.rewrite(
            listOf(
                PipelineToken(0, "ここまで", "ここまで", 0, 4),
                PipelineToken(0, "そこまで", "そこまで", 4, 8),
                PipelineToken(0, "あそこまで", "あそこまで", 8, 13),
                PipelineToken(0, "どこまで", "どこまで", 13, 17),
            ),
        )

        assertThat(rewritten.map { it.surface }).containsExactly(
            "ここ",
            "まで",
            "そこ",
            "まで",
            "あそこ",
            "まで",
            "どこ",
            "まで",
        )
        assertThat(rewritten.map { it.headword }).containsExactly(
            "ここ",
            "まで",
            "そこ",
            "まで",
            "あそこ",
            "まで",
            "どこ",
            "まで",
        )
        assertThat(rewritten.map { it.charStart to it.charEnd }).containsExactly(
            0 to 2,
            2 to 4,
            4 to 6,
            6 to 8,
            8 to 11,
            11 to 13,
            13 to 15,
            15 to 17,
        )
    }

    @Test
    fun `gives rule-resolved grammar tokens katakana readings`() {
        // Readings are stored in katakana pipeline-wide.
        assertThat(provider.resolve(token("は"))!!.reading).isEqualTo("ハ")
        assertThat(provider.resolve(token("ている"))!!.baseFormReading).isEqualTo("テイル")
        assertThat(provider.resolve(token("どうして"))!!.reading).isEqualTo("ドウシテ")

        val ikagashite = provider.resolve(token("如何して"))!!
        assertThat(ikagashite.surface).isEqualTo("如何して") // kanji spelling is kept
        assertThat(ikagashite.reading).isEqualTo("ドウシテ")
    }

    @Test
    fun `gives rewritten tokens katakana readings`() {
        val rewritten = provider.rewrite(listOf(PipelineToken(0, "ここまで", "ここまで", 0, 4)))

        assertThat(rewritten.map { it.usedReading }).containsExactly("ココ", "マデ")
        assertThat(rewritten.map { it.baseFormReading }).containsExactly("ココ", "マデ")
    }

    @Test
    fun `gives rewritten tokens a context gloss`() {
        // ここ is a kana headword answered with several homophones; an empty gloss would strip the hint that tells them apart.
        val rewritten = provider.rewrite(listOf(PipelineToken(0, "ここまで", "ここまで", 0, 4)))

        assertThat(rewritten.map { it.contextGloss }).allSatisfy { assertThat(it).isNotBlank() }
        assertThat(rewritten.first().contextGloss).contains("here")
    }

    private fun token(surface: String) = PipelineToken(0, surface, surface, 0, surface.length)
}
