package com.japanese.vocabulary.flashcard.service

import com.japanese.vocabulary.flashcard.dto.*
import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import com.japanese.vocabulary.flashcard.repository.FlashcardRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.user.repository.UserSettingsRepository
import com.japanese.vocabulary.word.repository.SongWordRepository
import com.japanese.vocabulary.word.repository.WordRepository
import io.github.openspacedrepetition.Card
import io.github.openspacedrepetition.Rating
import io.github.openspacedrepetition.Scheduler
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.Duration
import java.time.Instant

@Service
class FlashcardService(
    private val flashcardRepository: FlashcardRepository,
    private val wordRepository: WordRepository,
    private val songWordRepository: SongWordRepository,
    private val songRepository: SongRepository,
    private val userSettingsRepository: UserSettingsRepository
) {

    @Transactional
    fun createFlashcard(userId: Long, wordId: Long) {
        if (flashcardRepository.findByWordId(wordId) != null) return

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
        flashcardRepository.save(entity)
    }

    @Transactional
    fun getDueFlashcards(userId: Long): DueFlashcardsResponse {
        backfillFlashcards(userId)

        val now = Instant.now()
        val dueEntities = flashcardRepository.findByUserIdAndDueLessThanEqual(userId, now)

        val wordIds = dueEntities.map { it.wordId }
        val words = wordRepository.findAllById(wordIds).associateBy { it.id }

        val songWordMap = wordIds
            .flatMap { wordId -> songWordRepository.findByWordId(wordId) }
            .associateBy { it.wordId }

        val songIds = songWordMap.values.map { it.songId }.toSet()
        val songMap = songRepository.findAllById(songIds).associateBy { it.id }

        val settings = userSettingsRepository.findByUserId(userId)
        val showIntervals = settings?.showIntervals ?: true
        val desiredRetention = settings?.requestRetention ?: 0.9

        val cards = dueEntities.mapNotNull { entity ->
            val word = words[entity.wordId] ?: return@mapNotNull null
            val songWord = songWordMap[entity.wordId]
            val song = songWord?.let { songMap[it.songId] }

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
                koreanText = word.koreanText,
                songTitle = song?.title,
                lyricLine = songWord?.lyricLine,
                state = entity.state,
                due = entity.due.toString(),
                intervals = intervals
            )
        }

        return DueFlashcardsResponse(cards = cards, totalCount = cards.size)
    }

    @Transactional
    fun reviewCard(userId: Long, flashcardId: Long, rating: Int): ReviewResponse {
        val entity = flashcardRepository.findById(flashcardId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "Flashcard not found") }

        if (entity.userId != userId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Not your flashcard")
        }

        val fsrsRating = when (rating) {
            1 -> Rating.AGAIN
            2 -> Rating.HARD
            3 -> Rating.GOOD
            4 -> Rating.EASY
            else -> throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Rating must be 1-4")
        }

        val settings = userSettingsRepository.findByUserId(userId)
        val desiredRetention = settings?.requestRetention ?: 0.9

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

    private fun backfillFlashcards(userId: Long) {
        val allWords = wordRepository.findByUserId(userId)
        val wordIds = allWords.mapNotNull { it.id }
        if (wordIds.isEmpty()) return

        val existingFlashcards = flashcardRepository.findByUserIdAndWordIdIn(userId, wordIds)
        val existingWordIds = existingFlashcards.map { it.wordId }.toSet()

        val missingWordIds = wordIds.filter { it !in existingWordIds }
        for (wordId in missingWordIds) {
            createFlashcard(userId, wordId)
        }
    }
}
