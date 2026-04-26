package com.japanese.vocabulary.flashcard.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.flashcard.dto.*
import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import com.japanese.vocabulary.flashcard.event.FlashcardCreatedEvent
import com.japanese.vocabulary.flashcard.event.FlashcardDeletedEvent
import com.japanese.vocabulary.flashcard.event.FlashcardReviewedEvent
import com.japanese.vocabulary.flashcard.repository.FlashcardRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.user.repository.UserSettingsRepository
import com.japanese.vocabulary.word.dto.ExampleSentence
import com.japanese.vocabulary.word.repository.SongWordRepository
import com.japanese.vocabulary.word.repository.WordRepository
import io.github.openspacedrepetition.Card
import io.github.openspacedrepetition.Rating
import io.github.openspacedrepetition.Scheduler
import org.springframework.context.ApplicationEventPublisher
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.Instant

@Service
class FlashcardService(
    private val flashcardRepository: FlashcardRepository,
    private val wordRepository: WordRepository,
    private val songWordRepository: SongWordRepository,
    private val songRepository: SongRepository,
    private val userSettingsRepository: UserSettingsRepository,
    private val eventPublisher: ApplicationEventPublisher
) {

    @Transactional
    fun createFlashcard(userId: Long, wordId: Long, songId: Long): Long {
        flashcardRepository.findByWordId(wordId)?.let { return it.id!! }

        val card = Card.builder().build()
        val entity = FlashcardEntity(
            wordId = wordId,
            userId = userId,
            due = card.due ?: Instant.now(),
            stability = card.stability ?: 0.0,
            difficulty = card.difficulty ?: 0.0,
            state = card.state?.ordinal ?: 0,
            fsrsCardJson = card.toJson()
        )
        val flashcardId = flashcardRepository.save(entity).id!!

        eventPublisher.publishEvent(FlashcardCreatedEvent(userId, flashcardId, songId))

        return flashcardId
    }

    @Transactional
    fun deleteByWordId(wordId: Long) {
        val flashcard = flashcardRepository.findByWordId(wordId) ?: return
        eventPublisher.publishEvent(FlashcardDeletedEvent(flashcard.id!!))
        flashcardRepository.delete(flashcard)
    }

    @Transactional
    fun resetByWordId(wordId: Long) {
        flashcardRepository.findByWordId(wordId)?.let { flashcard ->
            flashcard.reset()
            flashcardRepository.save(flashcard)
        }
    }

    @Transactional
    fun getDueFlashcards(userId: Long, songId: Long? = null): DueFlashcardsResponse {
        val now = Instant.now()
        val dueEntities = if (songId != null) {
            flashcardRepository.findDueByUserIdAndSongId(userId, songId, now)
        } else {
            flashcardRepository.findByUserIdAndDueLessThanEqual(userId, now)
        }

        val wordIds = dueEntities.map { it.wordId }
        val words = wordRepository.findAllById(wordIds).associateBy { it.id }

        val songWordMap = songWordRepository.findByWordIdIn(wordIds).groupBy { it.wordId }

        val songIds = songWordMap.values.flatten().map { it.songId }.toSet()
        val songMap = songRepository.findAllById(songIds).associateBy { it.id }

        val settingsData = userSettingsRepository.findByUserId(userId)?.settings
        val showIntervals = settingsData?.showIntervals ?: true
        val desiredRetention = settingsData?.requestRetention ?: 0.9

        val cards = dueEntities.mapNotNull { entity ->
            val word = words[entity.wordId] ?: return@mapNotNull null
            val songWords = songWordMap[entity.wordId] ?: emptyList()
            val examples = songWords.map { sw ->
                ExampleSentence(
                    id = sw.id!!,
                    songId = sw.songId,
                    songTitle = songMap[sw.songId]?.title,
                    lyricLine = sw.lyricLine,
                    koreanLyricLine = sw.koreanLyricLine,
                    artworkUrl = songMap[sw.songId]?.artworkUrl
                )
            }

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

            FlashcardDTO(
                id = entity.id!!,
                wordId = entity.wordId,
                japanese = word.japaneseText,
                reading = word.reading,
                meanings = word.meanings,
                examples = examples,
                state = entity.state,
                due = entity.due.toString(),
                intervals = intervals
            )
        }

        return DueFlashcardsResponse(cards = cards.shuffled(), totalCount = cards.size)
    }

    @Transactional
    fun reviewCard(userId: Long, flashcardId: Long, rating: Int): ReviewResponse {
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

        val desiredRetention = userSettingsRepository.findByUserId(userId)?.settings?.requestRetention ?: 0.9

        val scheduler = Scheduler.builder()
            .desiredRetention(desiredRetention)
            .build()

        val card = Card.fromJson(entity.fsrsCardJson)
        val result = scheduler.reviewCard(card, fsrsRating)
        val updatedCard = result.card()

        entity.due = updatedCard.due ?: Instant.now()
        entity.stability = updatedCard.stability ?: 0.0
        entity.difficulty = updatedCard.difficulty ?: 0.0
        entity.state = updatedCard.state?.ordinal ?: 0
        entity.lastReview = Instant.now()
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

        return ReviewResponse(
            id = entity.id!!,
            state = entity.state,
            due = entity.due.toString(),
            stability = entity.stability,
            difficulty = entity.difficulty
        )
    }

    @Transactional(readOnly = true)
    fun getStats(userId: Long): FlashcardStatsResponse {
        val now = Instant.now()
        val total = flashcardRepository.countByUserId(userId)
        val due = flashcardRepository.countByUserIdAndDueLessThanEqual(userId, now)
        val newCount = flashcardRepository.countByUserIdAndLastReviewIsNull(userId)
        val learning = flashcardRepository.countByUserIdAndState(userId, 0) +
                flashcardRepository.countByUserIdAndState(userId, 2) // LEARNING + RELEARNING
        val review = flashcardRepository.countByUserIdAndState(userId, 1) // REVIEW

        return FlashcardStatsResponse(
            total = total,
            due = due,
            newCount = newCount,
            learning = learning - newCount, // subtract never-reviewed cards
            review = review
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
