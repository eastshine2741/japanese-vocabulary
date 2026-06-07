package com.japanese.vocabulary.studystats

import com.japanese.vocabulary.flashcard.event.FlashcardReviewedEvent
import com.japanese.vocabulary.studystats.entity.DailyStudySummaryEntity
import com.japanese.vocabulary.studystats.event.StudyStatsEventListener
import com.japanese.vocabulary.studystats.repository.DailyStudySummaryRepository
import com.japanese.vocabulary.studystats.util.KstClock
import com.japanese.vocabulary.test.ApiAfterCommitListenerTest
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.user.entity.UserEntity
import com.japanese.vocabulary.userinventory.entity.InventoryItemType
import com.japanese.vocabulary.userinventory.service.UserInventoryService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired

/**
 * Direct-call listener test. Listener carries @Transactional(REQUIRES_NEW), so setup must
 * be committed beforehand via inTx { ... } — otherwise the listener's separate connection
 * cannot see the uncommitted entities. See AfterCommitListenerTest for the full rationale.
 */
class StudyStatsEventListenerTest : ApiAfterCommitListenerTest() {

    @Autowired private lateinit var listener: StudyStatsEventListener
    @Autowired private lateinit var summaryRepository: DailyStudySummaryRepository
    @Autowired private lateinit var userInventoryService: UserInventoryService
    @Autowired private lateinit var kstClock: KstClock

    private fun newUser(): UserEntity = inTx { TestUserBuilder(entityManager).build() }

    private fun seedDay(user: UserEntity, date: java.time.LocalDate) {
        inTx {
            entityManager.persist(
                DailyStudySummaryEntity(userId = user.id!!, dateKst = date, reviewCount = 1),
            )
        }
    }

    private fun reviewed(user: UserEntity): FlashcardReviewedEvent = FlashcardReviewedEvent(
        userId = user.id!!,
        flashcardId = 1L,
        rating = 3,
        reviewedAt = clock.instant(),
    )

    @Test
    fun `first review of the day creates a summary row with count=1`() {
        val me = newUser()
        val today = kstClock.todayStudyDate()

        listener.onFlashcardReviewed(reviewed(me))

        val row = summaryRepository.findByUserIdAndDateKst(me.id!!, today)!!
        assertThat(row.reviewCount).isEqualTo(1)
        assertThat(row.freezeUsed).isFalse
    }

    @Test
    fun `subsequent same-day review increments reviewCount via upsert`() {
        val me = newUser()
        val today = kstClock.todayStudyDate()

        listener.onFlashcardReviewed(reviewed(me))
        listener.onFlashcardReviewed(reviewed(me))
        listener.onFlashcardReviewed(reviewed(me))

        val row = summaryRepository.findByUserIdAndDateKst(me.id!!, today)!!
        assertThat(row.reviewCount).isEqualTo(3)
    }

    @Test
    fun `streak of 7 on first review of the day grants a STREAK_FREEZE`() {
        val me = newUser()
        val today = kstClock.todayStudyDate()
        (1..6).forEach { seedDay(me, today.minusDays(it.toLong())) }
        assertThat(userInventoryService.quantityOf(me.id!!, InventoryItemType.STREAK_FREEZE)).isZero

        listener.onFlashcardReviewed(reviewed(me))

        assertThat(userInventoryService.quantityOf(me.id!!, InventoryItemType.STREAK_FREEZE)).isEqualTo(1)
    }

    @Test
    fun `streak of 1 grants no freeze`() {
        val me = newUser()

        listener.onFlashcardReviewed(reviewed(me))

        assertThat(userInventoryService.quantityOf(me.id!!, InventoryItemType.STREAK_FREEZE)).isZero
    }
}
