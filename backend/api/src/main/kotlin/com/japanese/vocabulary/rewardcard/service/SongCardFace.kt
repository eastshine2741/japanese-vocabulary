package com.japanese.vocabulary.rewardcard.service

import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import com.japanese.vocabulary.flashcard.model.FlashcardMemory
import com.japanese.vocabulary.rewardcard.dto.RewardCardGoalResponse
import com.japanese.vocabulary.rewardcard.dto.RewardCardWordResponse
import com.japanese.vocabulary.rewardcard.model.SongCardGrade
import com.japanese.vocabulary.song.dto.songdetail.SongLyricLineDto
import com.japanese.vocabulary.word.dto.songword.WordInSongItemDto
import kotlin.math.ceil

/** 카드 면에 싣는 곡 데이터. 단계 진행은 조회 때 계산한다. */
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

    /** 카드에 실린 가사 줄에 나오는 단어 중 중요한 것부터. */
    fun words(words: List<WordInSongItemDto>, lineIndexes: Collection<Int>): List<RewardCardWordResponse> =
        words.filter { !it.koreanText.isNullOrBlank() && it.lineIndexes.any(lineIndexes::contains) }
            .sortedByDescending { it.importanceScore }
            .take(WORD_COUNT)
            .map { RewardCardWordResponse(japanese = it.japanese, reading = it.reading.orEmpty(), meaning = it.senses.firstOrNull()?.meaning ?: it.koreanText!!) }

    /** 받은 등급 위 등급마다의 진행, 등급 순서대로: 단계 등급은 그 단계의 공부한 단어 수, 마스터는 90% 목표까지의 장기기억 수. */
    fun goals(top: SongCardGrade, tiers: List<List<FlashcardEntity?>>, longTermDays: Double): List<RewardCardGoalResponse> =
        SongCardGrade.entries.filter { it > top }.mapNotNull { goal(it, tiers, longTermDays) }

    private fun goal(grade: SongCardGrade, tiers: List<List<FlashcardEntity?>>, longTermDays: Double): RewardCardGoalResponse? {
        if (grade != SongCardGrade.MASTER) {
            val tier = tiers.getOrNull(grade.ordinal - 1) ?: return null
            return RewardCardGoalResponse(grade, current = tier.count { FlashcardMemory.of(it, longTermDays) != FlashcardMemory.REMAINING }, total = tier.size)
        }
        val all = tiers.flatten()
        val target = ceil(all.size * SongCardGradeRule.MASTER_PERCENT / 100.0).toInt()
        val longTerm = all.count { FlashcardMemory.of(it, longTermDays) == FlashcardMemory.LONG_TERM }
        return RewardCardGoalResponse(grade, current = minOf(longTerm, target), total = target)
    }
}
