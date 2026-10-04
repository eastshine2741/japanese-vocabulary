package com.japanese.vocabulary.flashcard.service

import com.japanese.vocabulary.flashcard.dto.SchedulePreviewWordDto
import com.japanese.vocabulary.flashcard.dto.StudyScheduleDayDto
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
import java.util.PriorityQueue

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
     * 지금 due 인 카드는 0일차, 오늘 남은 시간에 due 가 되는 카드는 1일차로 센다.
     */
    @Transactional(readOnly = true)
    fun getSchedule(userId: Long, dailyTarget: Int, dayEnds: List<Instant>): StudyScheduleDto {
        val now = Instant.now(clock)
        val cards = flashcardRepository.findByUserId(userId)
            .map { SimCard(id = it.id!!, wordId = it.wordId, due = it.due, card = Card.fromJson(it.fsrsCardJson)) }
            .sortedWith(QUEUE_ORDER)
        val dueNow = cards.filter { it.due <= now }

        return StudyScheduleDto(
            dueToday = dueNow.size.toLong(),
            totalCards = cards.size.toLong(),
            previewWords = previewWords(dueNow.take(PREVIEW_WORD_LIMIT)),
            days = scheduledDue(cards, now, dayEnds)
                .zip(simulatedReview(cards, now, dailyTarget, dayEnds))
                .map { (scheduled, simulated) -> StudyScheduleDayDto(scheduled, simulated) },
        )
    }

    private fun previewWords(head: List<SimCard>): List<SchedulePreviewWordDto> {
        val words = wordRepository.findAllById(head.map { it.wordId }).associateBy { it.id }
        return head.mapNotNull { card ->
            words[card.wordId]?.let { SchedulePreviewWordDto(wordId = card.wordId, japanese = it.japaneseText) }
        }
    }

    private fun scheduledDue(cards: List<SimCard>, now: Instant, dayEnds: List<Instant>): List<Int> {
        val counts = IntArray(dayEnds.size)
        for (card in cards) {
            val day = dayOf(card.due, now, dayEnds) ?: continue
            counts[day]++
        }
        return counts.toList()
    }

    /** 하루마다 큐 앞에서 [dailyTarget] 장을 집어 전부 GOOD 으로 평가하고 다음 날로 넘어간다. */
    private fun simulatedReview(cards: List<SimCard>, now: Instant, dailyTarget: Int, dayEnds: List<Instant>): List<Int> {
        val queue = PriorityQueue(QUEUE_ORDER).apply { addAll(cards) }
        return dayEnds.indices.map { day ->
            val dayStart = if (day == 0) now else dayEnds[day - 1]
            val reviewed = mutableListOf<SimCard>()
            while (reviewed.size < dailyTarget && queue.peek()?.let { isDueOn(it.due, day, now, dayEnds) } == true) {
                val card = queue.poll()
                val reviewAt = maxOf(card.due, dayStart)
                val next = SCHEDULER.reviewCard(card.card, Rating.GOOD, reviewAt).card()
                reviewed += card.copy(due = next.due ?: reviewAt, card = next)
            }
            queue.addAll(reviewed)
            reviewed.size
        }
    }

    private fun dayOf(due: Instant, now: Instant, dayEnds: List<Instant>): Int? {
        if (due <= now) return 0
        val day = dayEnds.indexOfFirst { due < it }
        return when {
            day < 0 -> null
            else -> maxOf(day, 1)
        }
    }

    /** 0일차는 지금 due 인 카드만, 그 뒤로는 그날이 끝나기 전에 due 가 되는 카드까지 집는다. */
    private fun isDueOn(due: Instant, day: Int, now: Instant, dayEnds: List<Instant>): Boolean =
        if (day == 0) due <= now else due < dayEnds[day]

    private data class SimCard(val id: Long, val wordId: Long, val due: Instant, val card: Card)

    companion object {
        private const val PREVIEW_WORD_LIMIT = 3
        private val QUEUE_ORDER = compareBy<SimCard>({ it.due }, { it.id })
        private val SCHEDULER: Scheduler = Scheduler.builder().desiredRetention(0.9).build()
    }
}
