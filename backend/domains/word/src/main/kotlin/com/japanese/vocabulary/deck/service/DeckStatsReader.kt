package com.japanese.vocabulary.deck.service

import com.japanese.vocabulary.deck.repository.DeckWordRepository
import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import com.japanese.vocabulary.flashcard.model.FlashcardMemory
import com.japanese.vocabulary.flashcard.model.FlashcardStudyState
import com.japanese.vocabulary.flashcard.repository.FlashcardRepository
import org.springframework.stereotype.Component
import java.time.Instant

data class DeckStats(
    val wordCount: Int,
    val dueCount: Int,
    val masteredCount: Int,
    val studyingCount: Int,
    val newWordCount: Int,
    val longTermCount: Int,
    val shortTermCount: Int,
)

/**
 * 여러 단어장의 통계를 쿼리 두 번으로 센다. SQL 에서 GROUP BY 로 묶으면 요청마다 MySQL 임시 테이블이 생겨
 * 집계는 앱에서 한다.
 */
@Component
class DeckStatsReader(
    private val deckWordRepository: DeckWordRepository,
    private val flashcardRepository: FlashcardRepository,
) {
    fun read(userId: Long, deckIds: Collection<Long>, now: Instant, longTermDays: Double): Map<Long, DeckStats> {
        if (deckIds.isEmpty()) return emptyMap()
        val memberships = deckWordRepository.findOwnedByDeckIdIn(userId, deckIds)
        if (memberships.isEmpty()) return emptyMap()
        val cards = flashcardRepository.findByUserIdAndWordIdIn(userId, memberships.map { it.wordId }.toSet())
            .associateBy { it.wordId }
        return memberships.groupBy({ it.deckId }, { cards[it.wordId] })
            .mapValues { (_, deckCards) -> statsOf(deckCards, now, longTermDays) }
    }

    // flashcard 가 없는 단어는 wordCount 에만 들어간다.
    private fun statsOf(deckCards: List<FlashcardEntity?>, now: Instant, longTermDays: Double): DeckStats {
        val present = deckCards.filterNotNull()
        val states = present.groupingBy { FlashcardStudyState.of(it) }.eachCount()
        val memories = present.groupingBy { FlashcardMemory.of(it, longTermDays) }.eachCount()
        return DeckStats(
            wordCount = deckCards.size,
            dueCount = present.count { it.due <= now },
            masteredCount = states[FlashcardStudyState.MASTERED] ?: 0,
            studyingCount = states[FlashcardStudyState.STUDYING] ?: 0,
            newWordCount = states[FlashcardStudyState.NEW] ?: 0,
            longTermCount = memories[FlashcardMemory.LONG_TERM] ?: 0,
            shortTermCount = memories[FlashcardMemory.SHORT_TERM] ?: 0,
        )
    }
}
