package com.japanese.vocabulary.notification

import java.time.LocalDate
import java.time.temporal.ChronoUnit

/**
 * 연속 학습 알림 문구 (docs/product-intents/260918-streak-commitment-api.md 3절).
 * 발송 대상 판정은 [StreakReminderScheduler]가 하고, 여기서는 슬롯·N·마지막 학습일만 보고
 * 제목/본문을 고른다. 보내지 않는 조합은 null.
 */
data class StreakReminderMessage(val title: String, val body: String) {

    enum class Slot { EVENING, NIGHT }

    companion object {
        /** 끊긴 유저에게 마지막(작별) 알림을 보내는 날. 마지막 학습일로부터 며칠 지났는지 기준. */
        private const val LAPSED_MAX_GAP_DAYS = 4L

        /**
         * @param streak 어제까지 이어진 연속 일수 (오늘 미학습 시점의 currentStreak). 0이면 끊김.
         * @param lastStudyDate 마지막 학습일. streak == 0 일 때만 본다.
         */
        fun compose(slot: Slot, streak: Int, lastStudyDate: LocalDate, today: LocalDate): StreakReminderMessage? {
            if (streak >= 1) {
                return when (slot) {
                    Slot.EVENING ->
                        if (streak == 1) StreakReminderMessage("우리 어제 막 만났는데...", "벌써 끝인가요? 새벽 4시 전에 카드 한 장이면 2일째가 돼요 😢")
                        else StreakReminderMessage("아직 오늘의 학습을 하지 않았어요!!", "${streak}일이나 해놓고 오늘 그냥 넘어가려고요? 카드 한 장이면 끝나요!")
                    Slot.NIGHT ->
                        if (streak == 1) StreakReminderMessage("정말 공부 안 하실 건가요...?", "당신을 믿었는데... 하루 만에 멈추실 건가요. 새벽 4시 전에 카드 한 장이면 돼요")
                        else StreakReminderMessage("당신의 의지는 여기까지입니까.", "더 할 수 있잖아요. ${streak}일을 여기서 버릴 건가요. 새벽 4시 전에 카드 한 장만 넘기세요")
                }
            }

            // 끊긴 유저: 20:00만. 끊긴 다음날(gap 2)과 마지막 작별(gap 4) 두 번. 어제가 비어 있으므로 gap 은 2 이상.
            if (slot == Slot.NIGHT) return null
            return when (ChronoUnit.DAYS.between(lastStudyDate, today)) {
                2L -> StreakReminderMessage("어제는 좀 피곤했잖아요. 오늘은 다르죠?", "새 마음으로 다시 시작해요. 카드 한 장이면 1일째예요. 당신은 할 수 있어요!")
                LAPSED_MAX_GAP_DAYS -> StreakReminderMessage("마지막으로 한 번만 부를게요", "제가 너무 귀찮게 했나 봐요. 마음이 바뀌면 카드 한 장으로 돌아와 주세요")
                else -> null
            }
        }
    }
}
