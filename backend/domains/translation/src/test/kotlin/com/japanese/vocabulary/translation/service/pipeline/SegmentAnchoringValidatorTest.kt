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
    fun `forces non-Japanese tokens to carry their surface as the reading`() {
        // Symbols and latin have no reading; whatever the model invented for them is discarded.
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
        assertThat(result.anchoredByIndex[0]!!.map { it.usedReading })
            .containsExactly("「", "ネコ", "」", " ", "yay")
    }

    @Test
    fun `accepts a line whose punctuation lives inside the katakana Unicode block`() {
        // `・` is U+30FB — inside the katakana block, but it has no reading. It must take the forcing
        // path like any other symbol; treating it as Japanese demanded a reading nothing could supply,
        // so the line failed every retry and took the whole song's analysis down with it.
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
        assertThat(result.anchoredByIndex[0]!!.map { it.usedReading })
            .containsExactly("ロックン", "・", "ロール")
    }

    @Test
    fun `requires the kanji iteration mark to be covered by segmentation`() {
        // 々 is read aloud, so leaving it uncovered would leak a raw glyph into the line's reading.
        val result = validator.anchor(
            mapOf(0 to "人々"),
            listOf(SegLineDto(0, listOf(word("人", "人", "ヒト", "ヒト")))),
        )

        assertThat(result.anchoredByIndex).isEmpty()
        assertThat(result.failuresByIndex[0]).contains("々")
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
        assertThat(result.failuresByIndex[0]).isEqualTo("Surface '明け' is not present in order at line index=0")
    }

    @Test
    fun `reports uncovered Japanese characters as a line failure`() {
        val result = validator.anchor(
            mapOf(0 to "猫が寝る"),
            listOf(SegLineDto(0, listOf(word("猫", "猫", "ネコ", "ネコ"), word("寝る", "寝る", "ネル", "ネル")))),
        )

        assertThat(result.anchoredByIndex).isEmpty()
        assertThat(result.failuresByIndex[0])
            .isEqualTo("Character 'が' at offset=1 is not covered by segmentation at line index=0")
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
