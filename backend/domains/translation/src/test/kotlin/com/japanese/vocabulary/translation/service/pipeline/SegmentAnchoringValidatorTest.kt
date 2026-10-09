package com.japanese.vocabulary.translation.service.pipeline

import com.japanese.vocabulary.translation.client.gemini.dto.SegLineDto
import com.japanese.vocabulary.translation.client.gemini.dto.SegWordDto
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class SegmentAnchoringValidatorTest {
    private val validator = SegmentAnchoringValidator()

    @Test
    fun `accepts ordered segmentation`() {
        val result = validator.anchor(
            mapOf(0 to "猫が寝る"),
            listOf(
                SegLineDto(
                    0,
                    listOf(
                        word("猫", "猫", "ネコ", "ネコ"),
                        word("が", "が", "ガ", "ガ"),
                        word("寝る", "寝る", "ネル", "ネル"),
                    ),
                ),
            ),
        )

        assertThat(result.failuresByIndex).isEmpty()
        assertThat(result.anchoredByIndex[0]!!.map { Triple(it.surface, it.charStart, it.charEnd) }).containsExactly(
            Triple("猫", 0, 1),
            Triple("が", 1, 2),
            Triple("寝る", 2, 4),
        )
    }

    @Test
    fun `trims digits glued to a counter so the headword is the counter alone`() {
        // `80億` as one word went to jisho as `80億`, which has no entry.
        val result = validator.anchor(
            mapOf(0 to "80億分の1の奇跡"),
            listOf(
                SegLineDto(
                    0,
                    listOf(
                        word("80億", "80億", "ハチジュウオク", "ハチジュウオク"),
                        word("分", "分", "ブン", "ブン"),
                        word("の", "の", "ノ", "ノ"),
                        word("の", "の", "ノ", "ノ"),
                        word("奇跡", "奇跡", "キセキ", "キセキ"),
                    ),
                ),
            ),
        )

        assertThat(result.failuresByIndex).isEmpty()
        assertThat(result.incompleteByIndex).isEmpty()
        val counter = result.anchoredByIndex[0]!!.first()
        assertThat(Triple(counter.surface, counter.charStart, counter.charEnd)).isEqualTo(Triple("億", 2, 3))
        assertThat(counter.headword).isEqualTo("億")
    }

    @Test
    fun `normalizes hiragana readings to katakana instead of failing the line`() {
        // Hiragana is absorbed rather than rejected: converting is cheaper than a retry.
        val result = validator.anchor(
            mapOf(0 to "行って"),
            listOf(SegLineDto(0, listOf(word("行って", "行く", "いって", "いく")))),
        )

        assertThat(result.failuresByIndex).isEmpty()
        val token = result.anchoredByIndex[0]!!.single()
        assertThat(token.usedReading).isEqualTo("イッテ")
        assertThat(token.baseFormReading).isEqualTo("イク")
    }

    @Test
    fun `keeps the inflected reading separate from the dictionary reading`() {
        val result = validator.anchor(
            mapOf(0 to "高く"),
            listOf(SegLineDto(0, listOf(word("高く", "高い", "タカク", "タカイ")))),
        )

        val token = result.anchoredByIndex[0]!!.single()
        assertThat(token.usedReading).isEqualTo("タカク")
        assertThat(token.baseFormReading).isEqualTo("タカイ")
        assertThat(token.contextGloss).isEqualTo("gloss")
    }

    @Test
    fun `reports a reading with kanji left in as a line failure`() {
        val result = validator.anchor(
            mapOf(0 to "寝る"),
            listOf(SegLineDto(0, listOf(word("寝る", "寝る", "寝る", "ネル")))),
        )

        assertThat(result.anchoredByIndex).isEmpty()
        assertThat(result.failuresByIndex[0])
            .isEqualTo("usedReading '寝る' for surface '寝る' is not kana-only at line index=0")
    }

    @Test
    fun `reports an empty reading as a line failure`() {
        val result = validator.anchor(
            mapOf(0 to "寝る"),
            listOf(SegLineDto(0, listOf(word("寝る", "寝る", "ネル", "")))),
        )

        assertThat(result.anchoredByIndex).isEmpty()
        assertThat(result.failuresByIndex[0])
            .isEqualTo("baseFormReading '' for surface '寝る' is not kana-only at line index=0")
    }

    @Test
    fun `drops non-Japanese tokens instead of anchoring them`() {
        // Symbols, spaces and latin need no token: they are read back out of the raw text by position.
        val result = validator.anchor(
            mapOf(0 to "「猫」 yay"),
            listOf(
                SegLineDto(
                    0,
                    listOf(
                        word("「", "「", "wrong", "wrong"),
                        word("猫", "猫", "ネコ", "ネコ"),
                        word("」", "」", "", ""),
                        word(" ", " ", "", ""),
                        word("yay", "yay", "ヤイ", "ヤイ"),
                    ),
                ),
            ),
        )

        assertThat(result.failuresByIndex).isEmpty()
        assertThat(result.anchoredByIndex[0]!!.map { Triple(it.surface, it.charStart, it.charEnd) })
            .containsExactly(Triple("猫", 1, 2))
    }

    @Test
    fun `an invented space does not consume the real space later in the line`() {
        // The model put a separator space after 涼しい that the line lacks; anchoring it matched the real
        // space at offset 6, dragged the cursor past 風吹く, and reported `風` (offset 3) as missing.
        val result = validator.anchor(
            mapOf(0 to "涼しい風吹く 青空の匂い"),
            listOf(
                SegLineDto(
                    0,
                    listOf(
                        word("涼しい", "涼しい", "スズシイ", "スズシイ"),
                        word(" ", " ", " ", " "),
                        word("風", "風", "カゼ", "カゼ"),
                        word("吹く", "吹く", "フク", "フク"),
                        word(" ", " ", " ", " "),
                        word("青空", "青空", "アオゾラ", "アオゾラ"),
                        word("の", "の", "ノ", "ノ"),
                        word("匂い", "匂い", "ニオイ", "ニオイ"),
                    ),
                ),
            ),
        )

        assertThat(result.failuresByIndex).isEmpty()
        assertThat(result.anchoredByIndex[0]!!.map { Triple(it.surface, it.charStart, it.charEnd) }).containsExactly(
            Triple("涼しい", 0, 3),
            Triple("風", 3, 4),
            Triple("吹く", 4, 6),
            Triple("青空", 7, 9),
            Triple("の", 9, 10),
            Triple("匂い", 10, 12),
        )
    }

    @Test
    fun `accepts a line whose punctuation lives inside the katakana Unicode block`() {
        // `・` is U+30FB, inside the katakana block but readingless; it must be dropped like any symbol.
        val result = validator.anchor(
            mapOf(0 to "ロックン・ロール"),
            listOf(
                SegLineDto(
                    0,
                    listOf(
                        word("ロックン", "ロックン", "ロックン", "ロックン"),
                        word("・", "・", "・", "・"),
                        word("ロール", "ロール", "ロール", "ロール"),
                    ),
                ),
            ),
        )

        assertThat(result.failuresByIndex).isEmpty()
        assertThat(result.anchoredByIndex[0]!!.map { Triple(it.surface, it.charStart, it.charEnd) }).containsExactly(
            Triple("ロックン", 0, 4),
            Triple("ロール", 5, 8),
        )
    }

    @Test
    fun `a line with no Japanese word anchors to no tokens rather than failing`() {
        val result = validator.anchor(
            mapOf(0 to "1, 2, 3"),
            listOf(SegLineDto(0, listOf(word("1", "1", "", ""), word("2", "2", "", ""), word("3", "3", "", "")))),
        )

        assertThat(result.failuresByIndex).isEmpty()
        assertThat(result.anchoredByIndex[0]).isEmpty()
    }

    @Test
    fun `counts the kanji iteration mark as text that must be covered`() {
        // 々 is read aloud, so leaving it uncovered loses a character the reader hears.
        val result = validator.anchor(
            mapOf(0 to "人々"),
            listOf(SegLineDto(0, listOf(word("人", "人", "ヒト", "ヒト")))),
        )

        assertThat(result.incompleteByIndex[0]?.text).contains("々")
        assertThat(result.failuresByIndex).isEmpty()
    }

    @Test
    fun `reports mutated surface as a line failure`() {
        val result = validator.anchor(
            mapOf(0 to "目を開けたなら yay"),
            listOf(
                SegLineDto(
                    0,
                    listOf(
                        word("目", "目", "メ", "メ"),
                        word("を", "を", "ヲ", "ヲ"),
                        word("明け", "開ける", "アケ", "アケル"),
                    ),
                ),
            ),
        )

        assertThat(result.anchoredByIndex).isEmpty()
        // The message names where the search stood, not just the word it could not find: `明け` really
        // is absent, and the remaining text is what the model has to re-segment.
        assertThat(result.failuresByIndex[0]).isEqualTo(
            "Surface '明け' is not present in order at line index=0: " +
                "the text still unmatched after surface 'を' is '開けたなら yay'",
        )
    }

    @Test
    fun `reports uncovered Japanese as incomplete, and keeps the tokens that did anchor`() {
        // Uncovered text is a missing word, not a wrong position: every surface was found where it is.
        val result = validator.anchor(
            mapOf(0 to "猫たち寝る"),
            listOf(SegLineDto(0, listOf(word("猫", "猫", "ネコ", "ネコ"), word("寝る", "寝る", "ネル", "ネル")))),
        )

        assertThat(result.failuresByIndex).isEmpty()
        assertThat(result.incompleteByIndex[0]?.message)
            .isEqualTo("Japanese text 'たち' at offset=1 is not covered by segmentation at line index=0")
        assertThat(result.anchoredByIndex.getValue(0).map { it.surface }).containsExactly("猫", "寝る")
        assertThat(result.anchoredByIndex.getValue(0).map { it.charStart }).containsExactly(0, 3)
    }

    @Test
    fun `a line with a surface out of order fails outright rather than counting as incomplete`() {
        // The opposite case: 寝る is searched for after the cursor passed it, so no offset can be trusted.
        val result = validator.anchor(
            mapOf(0 to "猫が寝る"),
            listOf(SegLineDto(0, listOf(word("寝る", "寝る", "ネル", "ネル"), word("猫", "猫", "ネコ", "ネコ")))),
        )

        assertThat(result.anchoredByIndex).isEmpty()
        assertThat(result.incompleteByIndex).isEmpty()
        assertThat(result.failuresByIndex[0]).contains("Surface '猫' is not present in order")
    }

    @Test
    fun `kana in parentheses right after a word is a reading annotation, not uncovered text`() {
        // 解答(こたえ): the parenthesized kana is how 解答 is pronounced, not a word of its own.
        val result = validator.anchor(
            mapOf(
                0 to "解答(こたえ)絶え絶え 嫌嫌嫌 嫌嫌嫌",
                1 to "イナイイナイ×点(ばってん)",
                2 to "的(まと)ハズレズレ 慈愛 嫌嫌",
                3 to "暗闇(クロ) マミレ理性 嫌嫌嫌",
            ),
            listOf(
                SegLineDto(
                    0,
                    listOf(
                        word("解答", "解答", "コタエ", "コタエ"),
                        word("絶え絶え", "絶え絶え", "タエダエ", "タエダエ"),
                        word("嫌嫌嫌", "嫌", "イヤイヤイヤ", "イヤ"),
                        word("嫌嫌嫌", "嫌", "イヤイヤイヤ", "イヤ"),
                    ),
                ),
                SegLineDto(
                    1,
                    listOf(
                        word("イナイイナイ", "いない", "イナイイナイ", "イナイ"),
                        word("点", "点", "バッテン", "テン"),
                    ),
                ),
                SegLineDto(
                    2,
                    listOf(
                        word("的", "的", "マト", "マト"),
                        word("ハズレズレ", "外れる", "ハズレズレ", "ハズレル"),
                        word("慈愛", "慈愛", "ジアイ", "ジアイ"),
                        word("嫌嫌", "嫌", "イヤイヤ", "イヤ"),
                    ),
                ),
                SegLineDto(
                    3,
                    listOf(
                        word("暗闇", "暗闇", "クロ", "クラヤミ"),
                        word("マミレ", "まみれ", "マミレ", "マミレ"),
                        word("理性", "理性", "リセイ", "リセイ"),
                        word("嫌嫌嫌", "嫌", "イヤイヤイヤ", "イヤ"),
                    ),
                ),
            ),
        )

        assertThat(result.failuresByIndex).isEmpty()
        assertThat(result.incompleteByIndex).isEmpty()
        assertThat(result.anchoredByIndex.getValue(0).map { it.surface })
            .containsExactly("解答", "絶え絶え", "嫌嫌嫌", "嫌嫌嫌")
        assertThat(result.anchoredByIndex.getValue(1).map { it.surface }).containsExactly("イナイイナイ", "点")
        assertThat(result.anchoredByIndex.getValue(2).map { it.surface })
            .containsExactly("的", "ハズレズレ", "慈愛", "嫌嫌")
        assertThat(result.anchoredByIndex.getValue(3).map { it.surface })
            .containsExactly("暗闇", "マミレ", "理性", "嫌嫌嫌")
    }

    @Test
    fun `a reading annotation in full-width parentheses is covered too`() {
        val result = validator.anchor(
            mapOf(0 to "解答（こたえ）"),
            listOf(SegLineDto(0, listOf(word("解答", "解答", "コタエ", "コタエ")))),
        )

        assertThat(result.failuresByIndex).isEmpty()
        assertThat(result.incompleteByIndex).isEmpty()
        assertThat(result.anchoredByIndex.getValue(0).map { Triple(it.surface, it.charStart, it.charEnd) })
            .containsExactly(Triple("解答", 0, 2))
    }

    @Test
    fun `a reading annotation that spells only the start of the reading covers the okurigana after it`() {
        // 愁(かな)しみ / 怠(たる)すぎ: the parenthesized kana starts the reading, the okurigana is the rest.
        val result = validator.anchor(
            mapOf(
                8 to "愁(かな)しみとは噛みすぎたガムの味さ",
                37 to "怠(たる)すぎたり、疲れちゃったり",
            ),
            listOf(
                SegLineDto(
                    8,
                    listOf(
                        word("愁", "悲しみ", "カナシミ", "カナシミ"),
                        word("とは", "とは", "トワ", "トワ"),
                        word("噛み", "噛む", "カミ", "カム"),
                        word("すぎ", "過ぎる", "スギ", "スギル"),
                        word("た", "た", "タ", "タ"),
                        word("ガム", "ガム", "ガム", "ガム"),
                        word("の", "の", "ノ", "ノ"),
                        word("味", "味", "アジ", "アジ"),
                        word("さ", "さ", "サ", "サ"),
                    ),
                ),
                SegLineDto(
                    37,
                    listOf(
                        word("怠", "怠い", "タルスギ", "タルイ"),
                        word("たり", "たり", "タリ", "タリ"),
                        word("疲れ", "疲れる", "ツカレ", "ツカレル"),
                        word("ちゃっ", "ちゃう", "チャッ", "チャウ"),
                        word("たり", "たり", "タリ", "タリ"),
                    ),
                ),
            ),
        )

        assertThat(result.failuresByIndex).isEmpty()
        assertThat(result.incompleteByIndex).isEmpty()
        assertThat(result.anchoredByIndex.getValue(8).first().let { it.charStart to it.charEnd }).isEqualTo(0 to 1)
        assertThat(result.anchoredByIndex.getValue(37).first().let { it.charStart to it.charEnd }).isEqualTo(0 to 1)
    }

    @Test
    fun `parenthesized kana that does not spell the word's reading is still uncovered`() {
        // Only a restated reading is swallowed; other kana is a skipped word, and kanji in
        // parentheses is never an annotation.
        val mismatch = validator.anchor(
            mapOf(0 to "暗闇(クロ)"),
            listOf(SegLineDto(0, listOf(word("暗闇", "暗闇", "クラヤミ", "クラヤミ")))),
        )
        assertThat(mismatch.incompleteByIndex[0]?.text).isEqualTo("クロ")

        val standalone = validator.anchor(
            mapOf(0 to "(こたえ) 猫"),
            listOf(SegLineDto(0, listOf(word("猫", "猫", "ネコ", "ネコ")))),
        )
        assertThat(standalone.incompleteByIndex[0]?.text).isEqualTo("こたえ")

        val kanji = validator.anchor(
            mapOf(0 to "猫(犬)"),
            listOf(SegLineDto(0, listOf(word("猫", "猫", "ネコ", "ネコ")))),
        )
        assertThat(kanji.incompleteByIndex[0]?.text).isEqualTo("犬")
    }

    @Test
    fun `parenthesized text left out is incomplete, not a failure`() {
        // 晴れ舞台（イェイ） came back as 晴れ舞台 on every attempt: the parenthesized ad-lib does not read as a lyric word.
        val result = validator.anchor(
            mapOf(0 to "晴れ舞台（イェイ）"),
            listOf(SegLineDto(0, listOf(word("晴れ舞台", "晴れ舞台", "ハレブタイ", "ハレブタイ")))),
        )

        assertThat(result.failuresByIndex).isEmpty()
        assertThat(result.incompleteByIndex[0]?.message)
            .isEqualTo("Japanese text 'イェイ' at offset=5 is not covered by segmentation at line index=0")
        assertThat(result.anchoredByIndex.getValue(0).map { it.surface }).containsExactly("晴れ舞台")
    }

    @Test
    fun `an echo of a word already anchored on the line is copied from that word`() {
        // The echo in parentheses came back once, as the first 見失う only; the repeat was UNCOVERED.
        val result = validator.anchor(
            mapOf(0 to "君を探し見失う (見失う, Ah-ah-ah-ah)"),
            listOf(
                SegLineDto(
                    0,
                    listOf(
                        word("君", "君", "キミ", "キミ"),
                        word("を", "を", "ヲ", "ヲ"),
                        word("探し", "探す", "サガシ", "サガス"),
                        word("見失う", "見失う", "ミウシナウ", "ミウシナウ"),
                    ),
                ),
            ),
        )

        assertThat(result.failuresByIndex).isEmpty()
        assertThat(result.incompleteByIndex).isEmpty()
        val tokens = result.anchoredByIndex.getValue(0)
        assertThat(tokens.map { Triple(it.surface, it.charStart, it.charEnd) }).containsExactly(
            Triple("君", 0, 1),
            Triple("を", 1, 2),
            Triple("探し", 2, 4),
            Triple("見失う", 4, 7),
            Triple("見失う", 9, 12),
        )
        assertThat(tokens.last().headword).isEqualTo("見失う")
        assertThat(tokens.last().usedReading).isEqualTo("ミウシナウ")
    }

    @Test
    fun `left-out text that is not an anchored surface stays uncovered after an echo`() {
        val result = validator.anchor(
            mapOf(0 to "猫 (猫) 犬"),
            listOf(SegLineDto(0, listOf(word("猫", "猫", "ネコ", "ネコ")))),
        )

        assertThat(result.incompleteByIndex[0]?.text).isEqualTo("犬")
        assertThat(result.anchoredByIndex.getValue(0).map { it.charStart }).containsExactly(0, 3)
    }

    @Test
    fun `absorbs a small vowel kana the model left off the word in front of it`() {
        // `あぁ` came back as the single surface `あ`. The small `ぁ` stretches the `あ` and is not a
        // word, so retrying never converged.
        val result = validator.anchor(
            mapOf(0 to "あぁ 夏を今もう一回 あぁ"),
            listOf(
                SegLineDto(
                    0,
                    listOf(
                        word("あ", "あ", "ア", "ア"),
                        word("夏", "夏", "ナツ", "ナツ"),
                        word("を", "を", "ヲ", "ヲ"),
                        word("今", "今", "イマ", "イマ"),
                        word("もう", "もう", "モウ", "モウ"),
                        word("一回", "一回", "イッカイ", "イッカイ"),
                        word("あ", "あ", "ア", "ア"),
                    ),
                ),
            ),
        )

        assertThat(result.failuresByIndex).isEmpty()
        assertThat(result.incompleteByIndex).isEmpty()
        assertThat(result.anchoredByIndex[0]!!.map { Triple(it.surface, it.charStart, it.charEnd) }).containsExactly(
            Triple("あぁ", 0, 2),
            Triple("夏", 3, 4),
            Triple("を", 4, 5),
            Triple("今", 5, 6),
            Triple("もう", 6, 8),
            Triple("一回", 8, 10),
            Triple("あぁ", 11, 13),
        )
        assertThat(result.anchoredByIndex[0]!!.first().usedReading).isEqualTo("アァ")
        assertThat(result.anchoredByIndex[0]!!.first().headword).isEqualTo("あ")
    }

    @Test
    fun `absorbs a trailing sokuon the model left off the word in front of it`() {
        // The `っ` closing `ずっと夢中っ` cuts the sound off for emphasis; it opens no word, so it joins `夢中`.
        val result = validator.anchor(
            mapOf(0 to "必中 げっちゅー ずっと夢中っ"),
            listOf(
                SegLineDto(
                    0,
                    listOf(
                        word("必中", "必中", "ヒッチュウ", "ヒッチュウ"),
                        word("げっちゅー", "げっちゅー", "ゲッチュー", "ゲッチュー"),
                        word("ずっと", "ずっと", "ズット", "ズット"),
                        word("夢中", "夢中", "ムチュウ", "ムチュウ"),
                    ),
                ),
            ),
        )

        assertThat(result.failuresByIndex).isEmpty()
        assertThat(result.incompleteByIndex).isEmpty()
        val last = result.anchoredByIndex[0]!!.last()
        assertThat(Triple(last.surface, last.charStart, last.charEnd)).isEqualTo(Triple("夢中っ", 12, 15))
        assertThat(last.usedReading).isEqualTo("ムチュウッ")
        assertThat(last.headword).isEqualTo("夢中")
    }

    @Test
    fun `absorbs an extra iteration mark the model left off a word that already repeats`() {
        // `悶々々` came back as `悶々`; the last `々` only stretches the repetition, so there is no word to segment.
        val result = validator.anchor(
            mapOf(1 to "誰の成れの果て？（なんだっての悶々々...）"),
            listOf(
                SegLineDto(
                    1,
                    listOf(
                        word("誰", "誰", "ダレ", "ダレ"),
                        word("の", "の", "ノ", "ノ"),
                        word("成れの果て", "成れの果て", "ナレノハテ", "ナレノハテ"),
                        word("なんだって", "なんだって", "ナンダッテ", "ナンダッテ"),
                        word("の", "の", "ノ", "ノ"),
                        word("悶々", "悶々", "モンモン", "モンモン"),
                    ),
                ),
            ),
        )

        assertThat(result.failuresByIndex).isEmpty()
        assertThat(result.incompleteByIndex).isEmpty()
        val last = result.anchoredByIndex.getValue(1).last()
        assertThat(Triple(last.surface, last.charStart, last.charEnd)).isEqualTo(Triple("悶々々", 15, 18))
        assertThat(last.headword).isEqualTo("悶々")
        assertThat(last.usedReading).isEqualTo("モンモン")
    }

    @Test
    fun `keeps a small kana the model did segment as its own token`() {
        // Absorption only claims text no surface did; a model that emits `ぁ` itself must still anchor.
        val result = validator.anchor(
            mapOf(0 to "あぁ"),
            listOf(SegLineDto(0, listOf(word("あ", "あ", "ア", "ア"), word("ぁ", "ぁ", "ァ", "ァ")))),
        )

        assertThat(result.failuresByIndex).isEmpty()
        assertThat(result.anchoredByIndex[0]!!.map { Triple(it.surface, it.charStart, it.charEnd) })
            .containsExactly(Triple("あ", 0, 1), Triple("ぁ", 1, 2))
    }

    @Test
    fun `a small kana with no covered text in front of it stays uncovered`() {
        // Nothing to stretch: the model skipped the word before it, and that word is what is missing.
        val result = validator.anchor(
            mapOf(0 to "猫あぁ"),
            listOf(SegLineDto(0, listOf(word("猫", "猫", "ネコ", "ネコ")))),
        )

        assertThat(result.incompleteByIndex[0]?.text).isEqualTo("あぁ")
    }

    @Test
    fun `reports duplicate line index as a line failure`() {
        val result = validator.anchor(
            mapOf(0 to "猫", 1 to "犬"),
            listOf(
                SegLineDto(0, listOf(word("猫", "猫", "ネコ", "ネコ"))),
                SegLineDto(0, listOf(word("猫", "猫", "ネコ", "ネコ"))),
                SegLineDto(1, listOf(word("犬", "犬", "イヌ", "イヌ"))),
            ),
        )

        assertThat(result.anchoredByIndex.keys).containsExactly(1)
        assertThat(result.failuresByIndex[0]).contains("Duplicate line index=0")
    }

    @Test
    fun `reports missing line as a line failure and keeps the other lines`() {
        val result = validator.anchor(
            mapOf(0 to "猫", 1 to "犬"),
            listOf(SegLineDto(0, listOf(word("猫", "猫", "ネコ", "ネコ")))),
        )

        assertThat(result.anchoredByIndex.keys).containsExactly(0)
        assertThat(result.failuresByIndex[1]).isEqualTo("Missing segmented line for index=1")
    }

    @Test
    fun `ignores lines that were not requested`() {
        val result = validator.anchor(
            mapOf(0 to "猫"),
            listOf(
                SegLineDto(0, listOf(word("猫", "猫", "ネコ", "ネコ"))),
                SegLineDto(7, listOf(word("犬", "犬", "イヌ", "イヌ"))),
            ),
        )

        assertThat(result.failuresByIndex).isEmpty()
        assertThat(result.anchoredByIndex.keys).containsExactly(0)
    }

    @Test
    fun `accepts omitted Latin suffix`() {
        val result = validator.anchor(
            mapOf(0 to "開けたなら yay"),
            listOf(
                SegLineDto(
                    0,
                    listOf(
                        word("開け", "開ける", "アケ", "アケル"),
                        word("た", "た", "タ", "タ"),
                        word("なら", "なら", "ナラ", "ナラ"),
                    ),
                ),
            ),
        )

        assertThat(result.failuresByIndex).isEmpty()
        assertThat(result.anchoredByIndex[0]!!.map { Triple(it.surface, it.charStart, it.charEnd) }).containsExactly(
            Triple("開け", 0, 2),
            Triple("た", 2, 3),
            Triple("なら", 3, 5),
        )
    }

    @Test
    fun `fills in a known one-character particle the model left out`() {
        // The line-final を was left out on every retry.
        val result = validator.anchor(
            mapOf(7 to "見てろ　時代の転換点を"),
            listOf(
                SegLineDto(
                    7,
                    listOf(
                        word("見てろ", "見る", "ミテロ", "ミル"),
                        word("時代", "時代", "ジダイ", "ジダイ"),
                        word("の", "の", "ノ", "ノ"),
                        word("転換点", "転換点", "テンカンテン", "テンカンテン"),
                    ),
                ),
            ),
        )

        assertThat(result.failuresByIndex).isEmpty()
        assertThat(result.incompleteByIndex).isEmpty()
        val particle = result.anchoredByIndex[7]!!.last()
        assertThat(Triple(particle.surface, particle.charStart, particle.charEnd)).isEqualTo(Triple("を", 10, 11))
        assertThat(particle.headword).isEqualTo("を")
    }

    @Test
    fun `fills in a connective te the model left off the verb`() {
        // 上げて was cut at 上げ, leaving the te uncovered on every retry.
        val result = validator.anchor(
            mapOf(59 to "声を上げて"),
            listOf(
                SegLineDto(
                    59,
                    listOf(
                        word("声", "声", "コエ", "コエ"),
                        word("を", "を", "ヲ", "ヲ"),
                        word("上げ", "上げる", "アゲ", "アゲル"),
                    ),
                ),
            ),
        )

        assertThat(result.incompleteByIndex).isEmpty()
        assertThat(result.anchoredByIndex[59]!!.map { it.surface }).containsExactly("声", "を", "上げ", "て")
    }

    @Test
    fun `still reports a left-out run that is not a known particle`() {
        val result = validator.anchor(
            mapOf(0 to "転換点をさ"),
            listOf(SegLineDto(0, listOf(word("転換点", "転換点", "テンカンテン", "テンカンテン")))),
        )

        assertThat(result.incompleteByIndex[0]!!.text).isEqualTo("をさ")
    }

    private fun word(surface: String, headword: String, usedReading: String, baseFormReading: String) =
        SegWordDto(surface, headword, usedReading, baseFormReading, "gloss")
}
