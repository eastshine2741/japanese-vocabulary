package com.japanese.vocabulary.notification

import com.japanese.vocabulary.notification.StreakReminderMessage.Slot
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.LocalDate

/** 연속 학습 알림 문구 표를 그대로 검증한다. */
class StreakReminderMessageTest {

    private val today: LocalDate = LocalDate.of(2026, 9, 20)

    @Test
    fun `evening N=1`() {
        val m = StreakReminderMessage.compose(Slot.EVENING, 1, today.minusDays(1), today)
        assertThat(m).isEqualTo(StreakReminderMessage("우리 어제 막 만났는데...", "벌써 끝인가요? 새벽 4시 전에 카드 한 장이면 2일째가 돼요 😢"))
    }

    @Test
    fun `evening N=3`() {
        val m = StreakReminderMessage.compose(Slot.EVENING, 3, today.minusDays(1), today)
        assertThat(m).isEqualTo(StreakReminderMessage("아직 오늘의 학습을 하지 않았어요!!", "3일이나 해놓고 오늘 그냥 넘어가려고요? 카드 한 장이면 끝나요!"))
    }

    @Test
    fun `night N=1`() {
        val m = StreakReminderMessage.compose(Slot.NIGHT, 1, today.minusDays(1), today)
        assertThat(m).isEqualTo(StreakReminderMessage("정말 공부 안 하실 건가요...?", "당신을 믿었는데... 하루 만에 멈추실 건가요. 새벽 4시 전에 카드 한 장이면 돼요"))
    }

    @Test
    fun `night N=5`() {
        val m = StreakReminderMessage.compose(Slot.NIGHT, 5, today.minusDays(1), today)
        assertThat(m).isEqualTo(StreakReminderMessage("당신의 의지는 여기까지입니까.", "더 할 수 있잖아요. 5일을 여기서 버릴 건가요. 새벽 4시 전에 카드 한 장만 넘기세요"))
    }

    @Test
    fun `lapsed - day after break gets restart message at evening only`() {
        val lastStudy = today.minusDays(2)
        assertThat(StreakReminderMessage.compose(Slot.EVENING, 0, lastStudy, today))
            .isEqualTo(StreakReminderMessage("어제는 좀 피곤했잖아요. 오늘은 다르죠?", "새 마음으로 다시 시작해요. 카드 한 장이면 1일째예요. 당신은 할 수 있어요!"))
        assertThat(StreakReminderMessage.compose(Slot.NIGHT, 0, lastStudy, today)).isNull()
    }

    @Test
    fun `lapsed - second day is silent`() {
        assertThat(StreakReminderMessage.compose(Slot.EVENING, 0, today.minusDays(3), today)).isNull()
    }

    @Test
    fun `lapsed - third day gets the farewell message once`() {
        assertThat(StreakReminderMessage.compose(Slot.EVENING, 0, today.minusDays(4), today))
            .isEqualTo(StreakReminderMessage("마지막으로 한 번만 부를게요", "제가 너무 귀찮게 했나 봐요. 마음이 바뀌면 카드 한 장으로 돌아와 주세요"))
        assertThat(StreakReminderMessage.compose(Slot.NIGHT, 0, today.minusDays(4), today)).isNull()
    }

    @Test
    fun `no message mentions a comma`() {
        val all = listOf(
            StreakReminderMessage.compose(Slot.EVENING, 1, today.minusDays(1), today),
            StreakReminderMessage.compose(Slot.EVENING, 2, today.minusDays(1), today),
            StreakReminderMessage.compose(Slot.NIGHT, 1, today.minusDays(1), today),
            StreakReminderMessage.compose(Slot.NIGHT, 2, today.minusDays(1), today),
            StreakReminderMessage.compose(Slot.EVENING, 0, today.minusDays(2), today),
            StreakReminderMessage.compose(Slot.EVENING, 0, today.minusDays(4), today),
        )
        all.forEach { m ->
            assertThat(m).isNotNull
            assertThat(m!!.title + m.body).doesNotContain(",")
        }
    }
}
