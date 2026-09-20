package com.japanese.vocabulary.notification

import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.Message
import com.japanese.vocabulary.notification.StreakReminderMessage.Slot
import com.japanese.vocabulary.notification.entity.DeviceTokenEntity
import com.japanese.vocabulary.studystats.entity.DailyStudySummaryEntity
import com.japanese.vocabulary.test.BatchBaseIntegrationTest
import com.japanese.vocabulary.user.entity.UserEntity
import com.japanese.vocabulary.user.entity.UserSettingsEntity
import com.japanese.vocabulary.user.model.UserSettingsData
import com.ninjasquad.springmockk.MockkBean
import io.mockk.every
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.context.TestPropertySource
import java.time.LocalDate
import java.util.concurrent.atomic.AtomicLong

/**
 * 후보 선정 규칙 검증 (intent C-2 수용 기준). 문구 자체는 [StreakReminderMessageTest]가 맡는다.
 * 다른 테스트가 남긴 토큰이 섞이지 않도록 결과는 이 테스트가 만든 userId 로만 거른다.
 */
@TestPropertySource(properties = ["push.firebase.enabled=true"])
class StreakReminderSchedulerTest : BatchBaseIntegrationTest() {

    @MockkBean
    private lateinit var firebaseApp: FirebaseApp

    @Autowired private lateinit var scheduler: StreakReminderScheduler

    private val today: LocalDate = LocalDate.of(2026, 9, 20)

    private fun newUser(token: Boolean = true, notificationsEnabled: Boolean? = null): UserEntity {
        val seq = USER_SEQUENCE.incrementAndGet()
        val user = UserEntity(
            provider = "google",
            providerSub = "streak-sub-$seq",
            username = "streak$seq",
        ).also { entityManager.persist(it) }
        if (token) {
            entityManager.persist(DeviceTokenEntity(userId = user.id!!, token = "streak-token-$seq", platform = "ANDROID"))
        }
        if (notificationsEnabled != null) {
            entityManager.persist(
                UserSettingsEntity(userId = user.id!!, settings = UserSettingsData(notificationsEnabled = notificationsEnabled)),
            )
        }
        entityManager.flush()
        return user
    }

    private fun studied(user: UserEntity, vararg daysAgo: Long) {
        daysAgo.forEach {
            entityManager.persist(DailyStudySummaryEntity(userId = user.id!!, dateKst = today.minusDays(it), reviewCount = 1))
        }
        entityManager.flush()
    }

    private fun candidatesFor(slot: Slot, vararg users: UserEntity): Map<Long, StreakReminderMessage> {
        val ids = users.map { it.id!! }.toSet()
        return scheduler.findCandidates(slot, today)
            .filter { it.userId in ids }
            .associate { it.userId to it.message }
    }

    @Test
    fun `sends to users who studied before but not today`() {
        val pending = newUser().also { studied(it, 1, 2, 3) }
        val doneToday = newUser().also { studied(it, 0, 1) }
        val neverStudied = newUser()

        val result = candidatesFor(Slot.EVENING, pending, doneToday, neverStudied)

        assertThat(result.keys).containsExactly(pending.id)
        assertThat(result[pending.id]!!.title).isEqualTo("🔥 3일 연속 학습 중! 오늘은 아직이에요")
    }

    @Test
    fun `skips users without token or with notifications disabled`() {
        val noToken = newUser(token = false).also { studied(it, 1) }
        val disabled = newUser(notificationsEnabled = false).also { studied(it, 1) }
        val enabledExplicitly = newUser(notificationsEnabled = true).also { studied(it, 1) }

        val result = candidatesFor(Slot.EVENING, noToken, disabled, enabledExplicitly)

        assertThat(result.keys).containsExactly(enabledExplicitly.id)
    }

    @Test
    fun `night slot skips lapsed users but keeps N=1`() {
        val startedYesterday = newUser().also { studied(it, 1) }
        val lapsed = newUser().also { studied(it, 2) }

        val result = candidatesFor(Slot.NIGHT, startedYesterday, lapsed)

        assertThat(result.keys).containsExactly(startedYesterday.id)
        assertThat(result[startedYesterday.id]!!.title).isEqualTo("⚠️ 어제 시작한 연속 학습이 끊기기 직전")
    }

    @Test
    fun `lapsed users get evening reminder for three days then stop`() {
        val dayAfter = newUser().also { studied(it, 2) }
        val thirdDay = newUser().also { studied(it, 4) }
        val fourthDay = newUser().also { studied(it, 5) }

        val result = candidatesFor(Slot.EVENING, dayAfter, thirdDay, fourthDay)

        assertThat(result.keys).containsExactlyInAnyOrder(dayAfter.id, thirdDay.id)
        assertThat(result[dayAfter.id]!!.title).isEqualTo("오늘 카드 한 장으로 다시 시작해요")
        assertThat(result[thirdDay.id]!!.title).isEqualTo("오늘 다시 시작해볼까요?")
    }

    @Test
    fun `freeze-filled yesterday keeps the streak number`() {
        val user = newUser().also { studied(it, 2, 3) }
        entityManager.persist(DailyStudySummaryEntity(userId = user.id!!, dateKst = today.minusDays(1), reviewCount = 0, freezeUsed = true))
        entityManager.flush()

        val result = candidatesFor(Slot.EVENING, user)

        assertThat(result[user.id]!!.title).isEqualTo("🔥 3일 연속 학습 중! 오늘은 아직이에요")
    }

    @Test
    fun `dispatch sends one message per candidate token`() {
        val user = newUser().also { studied(it, 1) }
        entityManager.persist(DeviceTokenEntity(userId = user.id!!, token = "streak-token-second-device", platform = "IOS"))
        entityManager.flush()
        every { firebaseMessaging.send(any<Message>()) } returns "fcm-message-id"

        val expected = scheduler.findCandidates(Slot.EVENING, today).size
        val result = scheduler.dispatch(Slot.EVENING, today)

        assertThat(expected).isGreaterThanOrEqualTo(2)
        assertThat(result.sent).isEqualTo(expected)
        assertThat(result.failed).isZero
        verify(exactly = expected) { firebaseMessaging.send(any<Message>()) }
    }

    companion object {
        private val USER_SEQUENCE = AtomicLong(0)
    }
}
