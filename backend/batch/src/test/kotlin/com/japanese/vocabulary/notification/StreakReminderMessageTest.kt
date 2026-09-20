package com.japanese.vocabulary.notification

import com.japanese.vocabulary.notification.StreakReminderMessage.Slot
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.LocalDate

/** C-2 문구 표를 그대로 검증한다. */
class StreakReminderMessageTest {

    private val today: LocalDate = LocalDate.of(2026, 9, 20)

    @Test
    fun `evening N=1`() {
        val m = StreakReminderMessage.compose(Slot.EVENING, 1, today.minusDays(1), today)
        assertThat(m).isEqualTo(StreakReminderMessage("어제의 첫 걸음을 이어가볼까요?", "카드 한 장만 넘기면 연속 학습 2일째예요!"))
    }

    @Test
    fun `evening N=3`() {
        val m = StreakReminderMessage.compose(Slot.EVENING, 3, today.minusDays(1), today)
        assertThat(m).isEqualTo(StreakReminderMessage("🔥 3일 연속 학습 중! 오늘은 아직이에요", "카드 한 장만 넘기면 4일째로 이어져요"))
    }

    @Test
    fun `night N=1`() {
        val m = StreakReminderMessage.compose(Slot.NIGHT, 1, today.minusDays(1), today)
        assertThat(m).isEqualTo(StreakReminderMessage("⚠️ 어제 시작한 연속 학습이 끊기기 직전", "자기 전에 카드 한 장만 넘겨주세요"))
    }

    @Test
    fun `night N=5`() {
        val m = StreakReminderMessage.compose(Slot.NIGHT, 5, today.minusDays(1), today)
        assertThat(m).isEqualTo(StreakReminderMessage("⚠️ 5일 연속이 끊기기 직전", "지금 카드 한 장만 넘겨주세요"))
    }

    @Test
    fun `lapsed - day after break gets restart message at evening only`() {
        val lastStudy = today.minusDays(2)
        assertThat(StreakReminderMessage.compose(Slot.EVENING, 0, lastStudy, today))
            .isEqualTo(StreakReminderMessage("오늘 카드 한 장으로 다시 시작해요", "어제 끊긴 연속 학습을 오늘 1일째부터 다시 쌓아요"))
        assertThat(StreakReminderMessage.compose(Slot.NIGHT, 0, lastStudy, today)).isNull()
    }

    @Test
    fun `lapsed - second and third day get the lighter restart message`() {
        val expected = StreakReminderMessage("오늘 다시 시작해볼까요?", "카드 한 장만 넘기면 연속 학습 1일째예요")
        assertThat(StreakReminderMessage.compose(Slot.EVENING, 0, today.minusDays(3), today)).isEqualTo(expected)
        assertThat(StreakReminderMessage.compose(Slot.EVENING, 0, today.minusDays(4), today)).isEqualTo(expected)
    }

    @Test
    fun `lapsed - fourth day onward is silent`() {
        assertThat(StreakReminderMessage.compose(Slot.EVENING, 0, today.minusDays(5), today)).isNull()
        assertThat(StreakReminderMessage.compose(Slot.EVENING, 0, today.minusDays(30), today)).isNull()
    }

    @Test
    fun `no message mentions a comma`() {
        val all = listOf(
            StreakReminderMessage.compose(Slot.EVENING, 1, today.minusDays(1), today),
            StreakReminderMessage.compose(Slot.EVENING, 2, today.minusDays(1), today),
            StreakReminderMessage.compose(Slot.NIGHT, 1, today.minusDays(1), today),
            StreakReminderMessage.compose(Slot.NIGHT, 2, today.minusDays(1), today),
            StreakReminderMessage.compose(Slot.EVENING, 0, today.minusDays(2), today),
            StreakReminderMessage.compose(Slot.EVENING, 0, today.minusDays(3), today),
        )
        all.forEach { m ->
            assertThat(m).isNotNull
            assertThat(m!!.title + m.body).doesNotContain(",")
        }
    }
}
