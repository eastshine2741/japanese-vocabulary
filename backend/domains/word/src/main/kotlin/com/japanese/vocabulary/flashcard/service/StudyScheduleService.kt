package com.japanese.vocabulary.flashcard.service

import com.japanese.vocabulary.flashcard.dto.MemoryForecastDayDto
import com.japanese.vocabulary.flashcard.dto.SchedulePreviewWordDto
import com.japanese.vocabulary.flashcard.dto.StudyScheduleDto
import com.japanese.vocabulary.flashcard.repository.FlashcardRepository
import com.japanese.vocabulary.word.repository.WordRepository
import io.github.openspacedrepetition.Card
import io.github.openspacedrepetition.Rating
import io.github.openspacedrepetition.Scheduler
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant
import kotlin.math.roundToInt

/**
 * 오늘의 복습 스케줄 (docs/product-intents/261004-study-schedule-api.md).
 * 시뮬레이션은 메모리에서만 돈다 — 실제 flashcard 는 건드리지 않는다.
 */
@Service
class StudyScheduleService(
    private val flashcardRepository: FlashcardRepository,
    private val wordRepository: WordRepository,
    private val clock: Clock,
) {

    /**
     * [dayEnds] 는 오늘부터 각 학습일이 끝나는 순간(다음 학습일의 시작, 미포함)이다. 학습일 경계(KST 04:00)는
     * 호출자가 정한다.
     */
    @Transactional(readOnly = true)
    fun getSchedule(userId: Long, dayEnds: List<Instant>): StudyScheduleDto {
        val now = Instant.now(clock)
        val cards = flashcardRepository.findByUserId(userId)
            .map { SimCard(id = it.id!!, wordId = it.wordId, due = it.due, card = Card.fromJson(it.fsrsCardJson)) }
            .sortedWith(QUEUE_ORDER)
        val dueNow = cards.filter { it.due <= now }
        // 새 카드는 아직 외운 적이 없으니 '지켜 줄 기억'에 넣지 않는다 — 넣으면 하루 만에 다 외운 것처럼 뛴다.
        val studied = cards.filter { it.card.lastReview != null }

        return StudyScheduleDto(
            dueToday = dueNow.size.toLong(),
            newToday = dueNow.count { it.card.lastReview == null }.toLong(),
            studiedCards = studied.size.toLong(),
            previewWords = previewWords(dueNow.take(PREVIEW_WORD_LIMIT)),
            days = memoryForecast(studied, now, dayEnds),
        )
    }

    private fun previewWords(head: List<SimCard>): List<SchedulePreviewWordDto> {
        val words = wordRepository.findAllById(head.map { it.wordId }).associateBy { it.id }
        return head.mapNotNull { card ->
            words[card.wordId]?.let { SchedulePreviewWordDto(wordId = card.wordId, japanese = it.japaneseText) }
        }
    }

    /** 학습일마다 시작 순간의 기억 수를 잰 뒤, 복습 시나리오만 그날 due 를 전부 GOOD 으로 넘긴다. */
    private fun memoryForecast(cards: List<SimCard>, now: Instant, dayEnds: List<Instant>): List<MemoryForecastDayDto> {
        val reviewed = cards.toMutableList()
        return dayEnds.indices.map { day ->
            val dayStart = if (day == 0) now else dayEnds[day - 1]
            val forecast = MemoryForecastDayDto(
                rememberedIfReviewed = remembered(reviewed, dayStart),
                rememberedIfSkipped = remembered(cards, dayStart),
            )
            for (i in reviewed.indices) {
                reviewed[i] = reviewThrough(reviewed[i], dayStart, dayEnds[day])
            }
            forecast
        }
    }

    private fun remembered(cards: List<SimCard>, at: Instant): Int =
        cards.sumOf { SCHEDULER.getCardRetrievability(it.card, at) }.roundToInt()

    /** learning 단계 카드는 같은 날 여러 번 돌아오므로 [dayEnd] 전에 due 가 남지 않을 때까지 넘긴다. */
    private fun reviewThrough(card: SimCard, dayStart: Instant, dayEnd: Instant): SimCard {
        var current = card
        while (current.due < dayEnd) {
            val reviewAt = maxOf(current.due, dayStart)
            val next = SCHEDULER.reviewCard(current.card, Rating.GOOD, reviewAt).card()
            current = current.copy(due = next.due ?: dayEnd, card = next)
        }
        return current
    }

    private data class SimCard(val id: Long, val wordId: Long, val due: Instant, val card: Card)

    companion object {
        private const val PREVIEW_WORD_LIMIT = 3
        private val QUEUE_ORDER = compareBy<SimCard>({ it.due }, { it.id })
        private val SCHEDULER: Scheduler = Scheduler.builder().desiredRetention(0.9).build()
    }
}
