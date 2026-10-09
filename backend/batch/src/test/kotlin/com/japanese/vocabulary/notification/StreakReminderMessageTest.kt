package com.japanese.vocabulary.notification

import com.japanese.vocabulary.notification.StreakReminderMessage.Slot
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.LocalDate

/** 연속 학습 알림 문구 표를 그대로 검증한다. */
class StreakReminderMessageTest {

    private val today: LocalDate = LocalDate.of(2026, 9, 20)

    private companion object {
        const val NAME = "홍길동"
    }

    @Test
    fun `evening N=1`() {
        val m = StreakReminderMessage.compose(Slot.EVENING, 1, today.minusDays(1), today, NAME)
        assertThat(m).isEqualTo(StreakReminderMessage("👀 홍길동님...?", "아직 오늘의 복습을 하지 않으셨네요. 그냥 그렇다고요."))
    }

    @Test
    fun `evening N=3`() {
        val m = StreakReminderMessage.compose(Slot.EVENING, 3, today.minusDays(1), today, NAME)
        assertThat(m).isEqualTo(StreakReminderMessage("👀 홍길동님...?", "아직 오늘의 복습을 하지 않으셨네요. 그냥 그렇다고요."))
    }

    @Test
    fun `night N=1`() {
        val m = StreakReminderMessage.compose(Slot.NIGHT, 1, today.minusDays(1), today, NAME)
        assertThat(m).isEqualTo(StreakReminderMessage("😱 조심하세요!!", "단어 하나만 공부해도 1일 연속이 유지돼요"))
    }

    @Test
    fun `night N=5`() {
        val m = StreakReminderMessage.compose(Slot.NIGHT, 5, today.minusDays(1), today, NAME)
        assertThat(m).isEqualTo(StreakReminderMessage("😱 조심하세요!!", "단어 하나만 공부해도 5일 연속이 유지돼요"))
    }

    @Test
    fun `lapsed - day after break gets restart message at evening only`() {
        val lastStudy = today.minusDays(2)
        assertThat(StreakReminderMessage.compose(Slot.EVENING, 0, lastStudy, today, NAME))
            .isEqualTo(StreakReminderMessage("어제는 좀 피곤했던 거죠?", "새 마음으로 다시 시작해봐요!!"))
        assertThat(StreakReminderMessage.compose(Slot.NIGHT, 0, lastStudy, today, NAME)).isNull()
    }

    @Test
    fun `lapsed - second day is silent`() {
        assertThat(StreakReminderMessage.compose(Slot.EVENING, 0, today.minusDays(3), today, NAME)).isNull()
    }

    @Test
    fun `lapsed - third day gets the farewell message once`() {
        assertThat(StreakReminderMessage.compose(Slot.EVENING, 0, today.minusDays(4), today, NAME))
            .isEqualTo(StreakReminderMessage("마지막으로 한 번만 부를게요.", "제가 너무 귀찮게 했나 봐요. 마음이 바뀌면 단어 한 장으로 돌아와 주세요"))
        assertThat(StreakReminderMessage.compose(Slot.NIGHT, 0, today.minusDays(4), today, NAME)).isNull()
    }

    @Test
    fun `no message mentions a comma`() {
        val all = listOf(
            StreakReminderMessage.compose(Slot.EVENING, 1, today.minusDays(1), today, NAME),
            StreakReminderMessage.compose(Slot.EVENING, 2, today.minusDays(1), today, NAME),
            StreakReminderMessage.compose(Slot.NIGHT, 1, today.minusDays(1), today, NAME),
            StreakReminderMessage.compose(Slot.NIGHT, 2, today.minusDays(1), today, NAME),
            StreakReminderMessage.compose(Slot.EVENING, 0, today.minusDays(2), today, NAME),
            StreakReminderMessage.compose(Slot.EVENING, 0, today.minusDays(4), today, NAME),
        )
        all.forEach { m ->
            assertThat(m).isNotNull
            assertThat(m!!.title + m.body).doesNotContain(",")
        }
    }
}
