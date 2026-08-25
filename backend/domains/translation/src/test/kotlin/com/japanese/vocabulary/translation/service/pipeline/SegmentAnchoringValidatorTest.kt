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
    fun `normalizes hiragana readings to katakana instead of failing the line`() {
        // The prompt asks for katakana, but converting the other script costs nothing and is cheaper
        // than a retry, so hiragana is absorbed rather than rejected.
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
        // Symbols, spaces and latin have no reading and no meaning; the assembled pronunciation and
        // the app both read them back out of the raw text by position, so they need no token.
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
        // The song-77 failure. The model put a separator space after 涼しい that the line does not
        // have; anchoring it matched the real space at offset 6, dragged the cursor past 風吹く, and
        // then reported the `風` sitting at offset 3 as "not present in order" — an unfixable
        // instruction the model answered with the same array three retries running.
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
        // `・` is U+30FB — inside the katakana block, but it has no reading. It must be dropped like
        // any other symbol; treating it as Japanese demanded a reading nothing could supply, so the
        // line failed every retry and took the whole song's analysis down with it.
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

        assertThat(result.incompleteByIndex[0]).contains("々")
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
        // Uncovered text is a missing word, not a wrong position: every surface here was found where
        // it really is, so throwing the line away would cost 猫 and 寝る to save nothing.
        val result = validator.anchor(
            mapOf(0 to "猫が寝る"),
            listOf(SegLineDto(0, listOf(word("猫", "猫", "ネコ", "ネコ"), word("寝る", "寝る", "ネル", "ネル")))),
        )

        assertThat(result.failuresByIndex).isEmpty()
        assertThat(result.incompleteByIndex[0])
            .isEqualTo("Japanese text 'が' at offset=1 is not covered by segmentation at line index=0")
        assertThat(result.anchoredByIndex.getValue(0).map { it.surface }).containsExactly("猫", "寝る")
        assertThat(result.anchoredByIndex.getValue(0).map { it.charStart }).containsExactly(0, 2)
    }

    @Test
    fun `a line with a surface out of order fails outright rather than counting as incomplete`() {
        // The opposite case, so the two severities stay distinguishable: 寝る is searched for after the
        // cursor has already passed it, and no offset in the line can be trusted afterwards.
        val result = validator.anchor(
            mapOf(0 to "猫が寝る"),
            listOf(SegLineDto(0, listOf(word("寝る", "寝る", "ネル", "ネル"), word("猫", "猫", "ネコ", "ネコ")))),
        )

        assertThat(result.anchoredByIndex).isEmpty()
        assertThat(result.incompleteByIndex).isEmpty()
        assertThat(result.failuresByIndex[0]).contains("Surface '猫' is not present in order")
    }

    @Test
    fun `parenthesized text left out is incomplete, not a failure`() {
        // The song killer: 晴れ舞台（イェイ） came back as 晴れ舞台 on every attempt, because the ad-lib in
        // parentheses does not read as a lyric word to the model.
        val result = validator.anchor(
            mapOf(0 to "晴れ舞台（イェイ）"),
            listOf(SegLineDto(0, listOf(word("晴れ舞台", "晴れ舞台", "ハレブタイ", "ハレブタイ")))),
        )

        assertThat(result.failuresByIndex).isEmpty()
        assertThat(result.incompleteByIndex[0])
            .isEqualTo("Japanese text 'イェイ' at offset=5 is not covered by segmentation at line index=0")
        assertThat(result.anchoredByIndex.getValue(0).map { it.surface }).containsExactly("晴れ舞台")
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

    private fun word(surface: String, headword: String, usedReading: String, baseFormReading: String) =
        SegWordDto(surface, headword, usedReading, baseFormReading, "gloss")
}
