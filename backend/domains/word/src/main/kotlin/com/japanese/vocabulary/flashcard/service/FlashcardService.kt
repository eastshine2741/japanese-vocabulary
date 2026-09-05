package com.japanese.vocabulary.flashcard.service

import org.springframework.stereotype.Service
import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import com.japanese.vocabulary.flashcard.event.FlashcardReviewedEvent
import com.japanese.vocabulary.flashcard.dto.DueFlashcardsDto
import com.japanese.vocabulary.flashcard.dto.FlashcardDto
import com.japanese.vocabulary.flashcard.dto.FlashcardStatsDto
import com.japanese.vocabulary.flashcard.dto.ReviewResultDto
import com.japanese.vocabulary.flashcard.repository.FlashcardRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.user.repository.UserSettingsRepository
import com.japanese.vocabulary.word.repository.WordRepository
import com.japanese.vocabulary.word.service.SenseEnricher
import com.japanese.vocabulary.word.service.SenseEnricher.toDtos
import io.github.openspacedrepetition.Card
import io.github.openspacedrepetition.Rating
import io.github.openspacedrepetition.Scheduler
import org.springframework.context.ApplicationEventPublisher
import org.springframework.data.domain.Pageable
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Duration
import java.time.Instant

@Service
class FlashcardService(
    private val flashcardRepository: FlashcardRepository,
    private val wordRepository: WordRepository,
    private val songRepository: SongRepository,
    private val userSettingsRepository: UserSettingsRepository,
    private val eventPublisher: ApplicationEventPublisher,
    private val clock: Clock,
) {

    /**
     * flashcard 는 word 와 수명주기가 같다 — flashcard 없는 word 는 존재할 수 없다.
     * 그래서 [com.japanese.vocabulary.word.service.WordService] 의 저장 트랜잭션이 매번 이걸
     * 부르고, 이미 있으면 그대로 재사용해서 FSRS 진행 상태를 보존한다.
     */
    @Transactional
    fun createFlashcard(userId: Long, wordId: Long): Long {
        flashcardRepository.findByWordId(wordId)?.let { return it.id!! }

        val card = Card.builder().build()
        val entity = FlashcardEntity(
            wordId = wordId,
            userId = userId,
            due = card.due ?: Instant.now(clock),
            stability = card.stability ?: 0.0,
            difficulty = card.difficulty ?: 0.0,
            state = card.state?.ordinal ?: 0,
            fsrsCardJson = card.toJson()
        )
        return flashcardRepository.save(entity).id!!
    }

    /** word 삭제와 같은 트랜잭션에서 불린다. `flashcards.word_id` 가 `words` 를 FK 로 참조한다. */
    @Transactional
    fun deleteByWordId(wordId: Long) {
        val flashcard = flashcardRepository.findByWordId(wordId) ?: return
        flashcardRepository.delete(flashcard)
    }

    @Transactional
    fun resetByWordId(wordId: Long) {
        flashcardRepository.findByWordId(wordId)?.let { flashcard ->
            flashcard.reset(Instant.now(clock))
            flashcardRepository.save(flashcard)
        }
    }

    @Transactional(readOnly = true)
    fun getDueFlashcards(userId: Long, limit: Int? = null): DueFlashcardsDto {
        val now = Instant.now(clock)
        val pageable = limit?.let { Pageable.ofSize(it) } ?: Pageable.unpaged()
        val entities = flashcardRepository.findByUserIdAndDueLessThanEqualOrderByDueAscIdAsc(userId, now, pageable)
        return assembleDueFlashcards(
            userId, entities, now,
            totalCount = flashcardRepository.countByUserIdAndDueLessThanEqual(userId, now).toInt(),
            nextDueAt = flashcardRepository.findFirstByUserIdAndDueGreaterThanOrderByDueAscIdAsc(userId, now)?.due,
        )
    }

    /**
     * Builds the due-flashcards view for a pre-selected id set — used by the deck module, which
     * owns the deck-scoped due query but must not assemble flashcard internals itself.
     *
     * [leadId] bypasses the due-date filter for one card — the deck module uses this to force a
     * word the user just tapped into the response even if FSRS hasn't made it due yet.
     */
    @Transactional(readOnly = true)
    fun getDueFlashcardsByIds(
        userId: Long,
        flashcardIds: List<Long>,
        now: Instant,
        totalCount: Int,
        nextDueAt: Instant?,
        leadId: Long? = null,
    ): DueFlashcardsDto {
        val byId = flashcardRepository.findAllById(flashcardIds).associateBy { it.id }
        val entities = flashcardIds.mapNotNull { byId[it] }
            .filter { it.userId == userId && (it.due <= now || it.id == leadId) }
        return assembleDueFlashcards(userId, entities, now, totalCount, nextDueAt)
    }

    /**
     * The flashcard id for a word and whether it is currently due — used by the deck module to
     * splice a specific word to the head of its due queue without duplicating due-date logic.
     */
    @Transactional(readOnly = true)
    fun findLeadCandidate(userId: Long, wordId: Long): LeadFlashcardCandidate? {
        val entity = flashcardRepository.findByWordId(wordId) ?: return null
        if (entity.userId != userId) return null
        return LeadFlashcardCandidate(id = entity.id!!, isDue = entity.due <= Instant.now(clock))
    }

    private fun assembleDueFlashcards(
        userId: Long,
        dueEntities: List<FlashcardEntity>,
        now: Instant,
        totalCount: Int,
        nextDueAt: Instant?,
    ): DueFlashcardsDto {
        val wordIds = dueEntities.map { it.wordId }
        val words = wordRepository.findAllById(wordIds).associateBy { it.id }
        val songMap = SenseEnricher.loadSongs(words.values.flatMap { it.senses }, songRepository)

        val settingsData = userSettingsRepository.findByUserId(userId)?.settings
        val showIntervals = settingsData?.showIntervals ?: true
        val desiredRetention = 0.9

        val cards = dueEntities.mapNotNull { entity ->
            val word = words[entity.wordId] ?: return@mapNotNull null

            val intervals = if (showIntervals) {
                val scheduler = Scheduler.builder()
                    .desiredRetention(desiredRetention)
                    .build()
                val card = Card.fromJson(entity.fsrsCardJson)
                mapOf(
                    1 to formatInterval(now, scheduler.reviewCard(card, Rating.AGAIN).card().due ?: now),
                    2 to formatInterval(now, scheduler.reviewCard(card, Rating.HARD).card().due ?: now),
                    3 to formatInterval(now, scheduler.reviewCard(card, Rating.GOOD).card().due ?: now),
                    4 to formatInterval(now, scheduler.reviewCard(card, Rating.EASY).card().due ?: now)
                )
            } else null

            FlashcardDto(
                id = entity.id!!,
                wordId = entity.wordId,
                japanese = word.japaneseText,
                reading = word.reading,
                senses = word.senses.toDtos(songMap),
                state = entity.state,
                due = entity.due.toString(),
                intervals = intervals,
            )
        }

        return DueFlashcardsDto(items = cards, totalCount = totalCount, nextDueAt = nextDueAt?.toString())
    }

    @Transactional
    fun reviewCard(userId: Long, flashcardId: Long, rating: Int): ReviewResultDto {
        val entity = flashcardRepository.findById(flashcardId)
            .orElseThrow { BusinessException(ErrorCode.FLASHCARD_NOT_FOUND) }

        if (entity.userId != userId) {
            throw BusinessException(ErrorCode.FORBIDDEN)
        }

        val fsrsRating = when (rating) {
            1 -> Rating.AGAIN
            2 -> Rating.HARD
            3 -> Rating.GOOD
            4 -> Rating.EASY
            else -> throw BusinessException(ErrorCode.INVALID_RATING)
        }

        val scheduler = Scheduler.builder()
            .desiredRetention(0.9)
            .build()

        val card = Card.fromJson(entity.fsrsCardJson)
        val result = scheduler.reviewCard(card, fsrsRating)
        val updatedCard = result.card()

        entity.due = updatedCard.due ?: Instant.now(clock)
        entity.stability = updatedCard.stability ?: 0.0
        entity.difficulty = updatedCard.difficulty ?: 0.0
        entity.state = updatedCard.state?.ordinal ?: 0
        entity.lastReview = Instant.now(clock)
        entity.fsrsCardJson = updatedCard.toJson()
        flashcardRepository.save(entity)

        eventPublisher.publishEvent(
            FlashcardReviewedEvent(
                userId = userId,
                flashcardId = entity.id!!,
                rating = rating,
                reviewedAt = entity.lastReview!!
            )
        )

        return ReviewResultDto(
            id = entity.id!!,
            state = entity.state,
            due = entity.due.toString(),
            stability = entity.stability,
            difficulty = entity.difficulty,
        )
    }

    @Transactional(readOnly = true)
    fun getStats(userId: Long): FlashcardStatsDto {
        val now = Instant.now(clock)
        val total = flashcardRepository.countByUserId(userId)
        val due = flashcardRepository.countByUserIdAndDueLessThanEqual(userId, now)
        val newCount = flashcardRepository.countByUserIdAndLastReviewIsNull(userId)
        val learning = flashcardRepository.countByUserIdAndState(userId, 0) +
                flashcardRepository.countByUserIdAndState(userId, 2) // LEARNING + RELEARNING
        val review = flashcardRepository.countByUserIdAndState(userId, 1) // REVIEW

        return FlashcardStatsDto(
            total = total,
            due = due,
            newCount = newCount,
            learning = learning - newCount, // subtract never-reviewed cards
            review = review,
        )
    }

    private fun formatInterval(from: Instant, to: Instant): String {
        val minutes = Duration.between(from, to).toMinutes()
        return when {
            minutes < 60 -> "${minutes}m"
            minutes < 1440 -> "${minutes / 60}h"
            else -> "${minutes / 1440}d"
        }
    }
}

data class LeadFlashcardCandidate(val id: Long, val isDue: Boolean)
