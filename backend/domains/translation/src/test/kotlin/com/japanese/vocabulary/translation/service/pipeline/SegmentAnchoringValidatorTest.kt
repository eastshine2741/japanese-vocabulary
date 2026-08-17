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
            listOf(SegLineDto(0, listOf(SegWordDto("猫", "猫"), SegWordDto("が", "が"), SegWordDto("寝る", "寝る")))),
        )

        assertThat(result.failuresByIndex).isEmpty()
        assertThat(result.anchoredByIndex[0]!!.map { Triple(it.surface, it.charStart, it.charEnd) }).containsExactly(
            Triple("猫", 0, 1),
            Triple("が", 1, 2),
            Triple("寝る", 2, 4),
        )
    }

    @Test
    fun `reports mutated surface as a line failure`() {
        val result = validator.anchor(
            mapOf(0 to "目を開けたなら yay"),
            listOf(SegLineDto(0, listOf(SegWordDto("目", "目"), SegWordDto("を", "を"), SegWordDto("明け", "開ける")))),
        )

        assertThat(result.anchoredByIndex).isEmpty()
        assertThat(result.failuresByIndex[0]).isEqualTo("Surface '明け' is not present in order at line index=0")
    }

    @Test
    fun `accepts segmentation that covers spaces and symbols`() {
        val result = validator.anchor(
            mapOf(0 to "「猫」 yay"),
            listOf(
                SegLineDto(
                    0,
                    listOf(
                        SegWordDto("「", "「"),
                        SegWordDto("猫", "猫"),
                        SegWordDto("」", "」"),
                        SegWordDto(" ", " "),
                        SegWordDto("yay", "yay"),
                    ),
                ),
            ),
        )

        assertThat(result.failuresByIndex).isEmpty()
        assertThat(result.anchoredByIndex[0]!!.map { Triple(it.surface, it.charStart, it.charEnd) }).containsExactly(
            Triple("「", 0, 1),
            Triple("猫", 1, 2),
            Triple("」", 2, 3),
            Triple(" ", 3, 4),
            Triple("yay", 4, 7),
        )
    }

    @Test
    fun `reports uncovered Japanese characters as a line failure`() {
        val result = validator.anchor(
            mapOf(0 to "猫が寝る"),
            listOf(SegLineDto(0, listOf(SegWordDto("猫", "猫"), SegWordDto("寝る", "寝る")))),
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
                SegLineDto(0, listOf(SegWordDto("猫", "猫"))),
                SegLineDto(0, listOf(SegWordDto("猫", "猫"))),
                SegLineDto(1, listOf(SegWordDto("犬", "犬"))),
            ),
        )

        assertThat(result.anchoredByIndex.keys).containsExactly(1)
        assertThat(result.failuresByIndex[0]).contains("Duplicate line index=0")
    }

    @Test
    fun `reports missing line as a line failure and keeps the other lines`() {
        val result = validator.anchor(
            mapOf(0 to "猫", 1 to "犬"),
            listOf(SegLineDto(0, listOf(SegWordDto("猫", "猫")))),
        )

        assertThat(result.anchoredByIndex.keys).containsExactly(0)
        assertThat(result.failuresByIndex[1]).isEqualTo("Missing segmented line for index=1")
    }

    @Test
    fun `ignores lines that were not requested`() {
        val result = validator.anchor(
            mapOf(0 to "猫"),
            listOf(
                SegLineDto(0, listOf(SegWordDto("猫", "猫"))),
                SegLineDto(7, listOf(SegWordDto("犬", "犬"))),
            ),
        )

        assertThat(result.failuresByIndex).isEmpty()
        assertThat(result.anchoredByIndex.keys).containsExactly(0)
    }

    @Test
    fun `accepts omitted Latin suffix`() {
        val result = validator.anchor(
            mapOf(0 to "開けたなら yay"),
            listOf(SegLineDto(0, listOf(SegWordDto("開け", "開ける"), SegWordDto("た", "た"), SegWordDto("なら", "なら")))),
        )

        assertThat(result.failuresByIndex).isEmpty()
        assertThat(result.anchoredByIndex[0]!!.map { Triple(it.surface, it.charStart, it.charEnd) }).containsExactly(
            Triple("開け", 0, 2),
            Triple("た", 2, 3),
            Triple("なら", 3, 5),
        )
    }
}
