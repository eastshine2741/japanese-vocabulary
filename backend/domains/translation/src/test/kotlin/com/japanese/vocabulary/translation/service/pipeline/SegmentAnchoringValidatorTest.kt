package com.japanese.vocabulary.translation.service.pipeline

import com.japanese.vocabulary.translation.client.gemini.dto.SegLineDto
import com.japanese.vocabulary.translation.client.gemini.dto.SegWordDto
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test

class SegmentAnchoringValidatorTest {
    private val validator = SegmentAnchoringValidator()

    @Test
    fun `accepts ordered segmentation`() {
        val result = validator.validate(
            mapOf(0 to "猫が寝る"),
            listOf(SegLineDto(0, listOf(SegWordDto("猫", "猫"), SegWordDto("が", "が"), SegWordDto("寝る", "寝る")))),
        )

        assertThat(result[0]!!.map { Triple(it.surface, it.charStart, it.charEnd) }).containsExactly(
            Triple("猫", 0, 1),
            Triple("が", 1, 2),
            Triple("寝る", 2, 4),
        )
    }

    @Test
    fun `rejects mutated surface`() {
        assertThatThrownBy {
            validator.validate(
                mapOf(0 to "目を開けたなら yay"),
                listOf(SegLineDto(0, listOf(SegWordDto("目", "目"), SegWordDto("を", "を"), SegWordDto("明け", "開ける")))),
            )
        }.isInstanceOf(SegmentationValidationException::class.java)
    }

    @Test
    fun `accepts segmentation that covers spaces and symbols`() {
        val result = validator.validate(
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

        assertThat(result[0]!!.map { Triple(it.surface, it.charStart, it.charEnd) }).containsExactly(
            Triple("「", 0, 1),
            Triple("猫", 1, 2),
            Triple("」", 2, 3),
            Triple(" ", 3, 4),
            Triple("yay", 4, 7),
        )
    }

    @Test
    fun `rejects uncovered Japanese characters`() {
        assertThatThrownBy {
            validator.validate(
                mapOf(0 to "猫が寝る"),
                listOf(SegLineDto(0, listOf(SegWordDto("猫", "猫"), SegWordDto("寝る", "寝る")))),
            )
        }.isInstanceOf(SegmentationValidationException::class.java)
    }

    @Test
    fun `rejects duplicate line indices`() {
        assertThatThrownBy {
            validator.validate(
                mapOf(0 to "猫", 1 to "犬"),
                listOf(
                    SegLineDto(0, listOf(SegWordDto("猫", "猫"))),
                    SegLineDto(0, listOf(SegWordDto("犬", "犬"))),
                ),
            )
        }.isInstanceOf(SegmentationValidationException::class.java)
            .hasMessageContaining("duplicate line indices")
    }

    @Test
    fun `accepts omitted Latin suffix`() {
        val result = validator.validate(
            mapOf(0 to "開けたなら yay"),
            listOf(SegLineDto(0, listOf(SegWordDto("開け", "開ける"), SegWordDto("た", "た"), SegWordDto("なら", "なら")))),
        )

        assertThat(result[0]!!.map { Triple(it.surface, it.charStart, it.charEnd) }).containsExactly(
            Triple("開け", 0, 2),
            Triple("た", 2, 3),
            Triple("なら", 3, 5),
        )
    }
}
