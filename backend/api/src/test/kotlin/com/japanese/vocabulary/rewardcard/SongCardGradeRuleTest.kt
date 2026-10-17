package com.japanese.vocabulary.rewardcard

import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import com.japanese.vocabulary.flashcard.model.FlashcardMemory
import com.japanese.vocabulary.rewardcard.model.ArtistCardGrade
import com.japanese.vocabulary.rewardcard.model.SongCardGrade
import com.japanese.vocabulary.rewardcard.service.SongCardGradeRule
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Instant

class SongCardGradeRuleTest {

    private val now = Instant.parse("2026-10-01T00:00:00Z")
    private val longTermDays = FlashcardMemory.LONG_TERM_STABILITY_DAYS

    private fun card(stability: Double) =
        FlashcardEntity(wordId = 0, userId = 0, due = now, stability = stability, lastReview = now)

    /** 단계 하나: 장기기억 [longTerm] 개, 단기기억 [shortTerm] 개, 나머지는 아직 안 본 단어. */
    private fun tier(total: Int, longTerm: Int = 0, shortTerm: Int = 0): List<FlashcardEntity?> =
        List(longTerm) { card(30.0) } + List(shortTerm) { card(1.0) } + List(total - longTerm - shortTerm) { null }

    @Test
    fun `counts only leading completed tiers`() {
        val grade = SongCardGradeRule.of(
            listOf(
                tier(total = 3, shortTerm = 2),
                tier(total = 2, shortTerm = 2),
                tier(total = 1, shortTerm = 1),
            ),
            longTermDays,
        )
        assertThat(grade).isEqualTo(SongCardGrade.BASIC)
    }

    @Test
    fun `completed tiers map to bronze and silver`() {
        val bronze = listOf(
            tier(total = 2, longTerm = 1, shortTerm = 1),
            tier(total = 2, shortTerm = 1),
            tier(total = 1),
        )
        assertThat(SongCardGradeRule.of(bronze, longTermDays)).isEqualTo(SongCardGrade.BRONZE)

        val silver = listOf(
            tier(total = 2, shortTerm = 2),
            tier(total = 0),
            tier(total = 1),
        )
        assertThat(SongCardGradeRule.of(silver, longTermDays)).isEqualTo(SongCardGrade.SILVER)
    }

    @Test
    fun `all tiers done is gold until ninety percent are long term`() {
        val gold = listOf(
            tier(total = 4, longTerm = 4),
            tier(total = 3, longTerm = 3),
            tier(total = 3, longTerm = 1, shortTerm = 2),
        )
        assertThat(SongCardGradeRule.of(gold, longTermDays)).isEqualTo(SongCardGrade.GOLD)

        val master = listOf(
            tier(total = 4, longTerm = 4),
            tier(total = 3, longTerm = 3),
            tier(total = 3, longTerm = 2, shortTerm = 1),
        )
        assertThat(SongCardGradeRule.of(master, longTermDays)).isEqualTo(SongCardGrade.MASTER)
    }

    @Test
    fun `song without tier words never masters`() {
        val empty = List(3) { tier(total = 0) }
        assertThat(SongCardGradeRule.of(empty, longTermDays)).isEqualTo(SongCardGrade.GOLD)
    }

    @Test
    fun `artist grade follows master count bands`() {
        assertThat(listOf(0, 1, 2, 3, 6, 7, 14, 15, 29, 30, 100).map { ArtistCardGrade.forMasterCount(it) })
            .containsExactly(
                ArtistCardGrade.BASIC, ArtistCardGrade.BRONZE, ArtistCardGrade.BRONZE, ArtistCardGrade.SILVER,
                ArtistCardGrade.SILVER, ArtistCardGrade.GOLD, ArtistCardGrade.GOLD, ArtistCardGrade.PLATINUM,
                ArtistCardGrade.PLATINUM, ArtistCardGrade.DIAMOND, ArtistCardGrade.DIAMOND,
            )
    }
}
