package com.japanese.vocabulary.studystats.event

import com.japanese.vocabulary.flashcard.event.FlashcardReviewedEvent
import com.japanese.vocabulary.studystats.repository.DailyStudySummaryRepository
import com.japanese.vocabulary.studystats.service.StreakCalculator
import com.japanese.vocabulary.studystats.service.StudyStatsService
import com.japanese.vocabulary.studystats.util.KstClock
import com.japanese.vocabulary.userinventory.entity.InventoryItemType
import com.japanese.vocabulary.userinventory.service.UserInventoryService
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component

@Component
class StudyStatsEventListener(
    private val repo: DailyStudySummaryRepository,
    private val streakCalculator: StreakCalculator,
    private val userInventoryService: UserInventoryService,
    private val kstClock: KstClock,
) {
    @EventListener
    fun onFlashcardReviewed(event: FlashcardReviewedEvent) {
        val dateKst = kstClock.toStudyDate(event.reviewedAt)
        val existing = repo.findByUserIdAndDateKst(event.userId, dateKst)
        repo.upsertIncrement(event.userId, dateKst)

        if (existing != null) return // not the first review of the day; skip milestone

        val streak = streakCalculator.currentStreak(event.userId, dateKst)
        if (streak > 0 && streak % FREEZE_MILESTONE_INTERVAL == 0) {
            userInventoryService.grant(
                userId = event.userId,
                itemType = InventoryItemType.STREAK_FREEZE,
                cap = StudyStatsService.FREEZE_CAP,
            )
        }
    }

    companion object {
        private const val FREEZE_MILESTONE_INTERVAL = 7
    }
}
