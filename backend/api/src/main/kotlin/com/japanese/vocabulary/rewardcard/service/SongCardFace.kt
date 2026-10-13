package com.japanese.vocabulary.rewardcard.service

import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import com.japanese.vocabulary.flashcard.model.FlashcardMemory
import com.japanese.vocabulary.flashcard.model.FlashcardRecall
import com.japanese.vocabulary.rewardcard.dto.RewardCardGoalResponse
import com.japanese.vocabulary.rewardcard.dto.RewardCardWordResponse
import com.japanese.vocabulary.rewardcard.model.SongCardGrade
import com.japanese.vocabulary.song.dto.songdetail.SongLyricLineDto
import com.japanese.vocabulary.word.dto.songword.WordInSongItemDto
import java.time.Instant
import kotlin.math.ceil

/** 카드 면에 싣는 곡 데이터. 단계 진행·기억 확률은 조회 때 계산한다. */
object SongCardFace {
    private const val WORD_COUNT = 5

    /** 주인이 고르기 전 기본 줄: 가장 많이 반복되는 줄(대개 후렴)과 그 다음 줄. 번역·분석이 없는 줄은 뒷면이 비어 건너뛴다. */
    fun defaultLyric(lines: List<SongLyricLineDto>): List<SongLyricLineDto> {
        val usable = lines.filter { it.originalText.isNotBlank() && it.tokens.isNotEmpty() && !it.koreanLyrics.isNullOrBlank() }
        if (usable.isEmpty()) return emptyList()
        val counts = usable.groupingBy { it.originalText }.eachCount()
        val first = usable.reduce { best, line -> if (counts.getValue(line.originalText) > counts.getValue(best.originalText)) line else best }
        val next = usable.firstOrNull { it.index > first.index && it.originalText != first.originalText }
        return listOfNotNull(first, next)
    }

    fun lyric(lines: List<SongLyricLineDto>, picked: List<Int>): List<SongLyricLineDto> =
        if (picked.isEmpty()) defaultLyric(lines) else lines.filter { it.index in picked }

    fun words(words: List<WordInSongItemDto>): List<RewardCardWordResponse> =
        words.filter { !it.koreanText.isNullOrBlank() }
            .sortedByDescending { it.importanceScore }
            .take(WORD_COUNT)
            .map { RewardCardWordResponse(japanese = it.japanese, reading = it.reading.orEmpty(), meaning = it.senses.firstOrNull()?.meaning ?: it.koreanText!!) }

    /**
     * 평균 기억 확률. 곡의 tier 단어 중 카드를 받은 뒤 리뷰한 카드로 잰다 — 다른 곡에서 공부하고 밀린 단어가 받자마자 카드를 낡게 하지 않게.
     * 잴 단어가 없으면 새것이다. 카드를 받게 한 리뷰는 카드보다 먼저 저장돼 빠지지만, 그래서 받는 순간은 새것이다.
     */
    fun recall(tiers: List<List<FlashcardEntity?>>, issuedAt: Instant, now: Instant): Double {
        val measured = tiers.flatten().filterNotNull().filter { card -> card.lastReview?.let { it >= issuedAt } == true }.distinctBy { it.id }
        if (measured.isEmpty()) return 1.0
        return measured.map { FlashcardRecall.of(it, now) }.average()
    }

    /** 다음 등급까지: 다음 단계의 공부한 단어 수, 완곡 뒤엔 90% 목표까지의 장기기억 수. 마스터면 없다. */
    fun nextGoal(grade: SongCardGrade, tiers: List<List<FlashcardEntity?>>): RewardCardGoalResponse? {
        if (grade == SongCardGrade.MASTER) return null
        if (grade < SongCardGrade.GOLD) {
            val tier = tiers.getOrNull(grade.ordinal) ?: return null
            return RewardCardGoalResponse(current = tier.count { FlashcardMemory.of(it) != FlashcardMemory.REMAINING }, total = tier.size)
        }
        val all = tiers.flatten()
        val target = ceil(all.size * SongCardGradeRule.MASTER_PERCENT / 100.0).toInt()
        val longTerm = all.count { FlashcardMemory.of(it) == FlashcardMemory.LONG_TERM }
        return RewardCardGoalResponse(current = minOf(longTerm, target), total = target)
    }
}
