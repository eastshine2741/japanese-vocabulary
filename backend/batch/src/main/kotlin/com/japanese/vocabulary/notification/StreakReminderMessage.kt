package com.japanese.vocabulary.notification

import java.time.LocalDate
import java.time.temporal.ChronoUnit

/**
 * 연속 학습 알림 문구 (docs/product-intents/260918-streak-commitment.md C-2).
 * 발송 대상 판정은 [StreakReminderScheduler]가 하고, 여기서는 슬롯·N·마지막 학습일만 보고
 * 제목/본문을 고른다. 보내지 않는 조합은 null.
 */
data class StreakReminderMessage(val title: String, val body: String) {

    enum class Slot { EVENING, NIGHT }

    companion object {
        /** 끊긴 유저에게 20:00 알림을 보내는 마지막 날. 마지막 학습일로부터 며칠 지났는지 기준. */
        private const val LAPSED_MAX_GAP_DAYS = 4L

        /**
         * @param streak 어제까지 이어진 연속 일수 (오늘 미학습 시점의 currentStreak). 0이면 끊김.
         * @param lastStudyDate 마지막 학습일. streak == 0 일 때만 본다.
         */
        fun compose(slot: Slot, streak: Int, lastStudyDate: LocalDate, today: LocalDate): StreakReminderMessage? {
            if (streak >= 1) {
                return when (slot) {
                    Slot.EVENING ->
                        if (streak == 1) StreakReminderMessage("어제의 첫 걸음을 이어가볼까요?", "카드 한 장만 넘기면 연속 학습 2일째예요!")
                        else StreakReminderMessage("🔥 ${streak}일 연속 학습 중! 오늘은 아직이에요", "카드 한 장만 넘기면 ${streak + 1}일째로 이어져요")
                    Slot.NIGHT ->
                        if (streak == 1) StreakReminderMessage("⚠️ 어제 시작한 연속 학습이 끊기기 직전", "자기 전에 카드 한 장만 넘겨주세요")
                        else StreakReminderMessage("⚠️ ${streak}일 연속이 끊기기 직전", "지금 카드 한 장만 넘겨주세요")
                }
            }

            // 끊긴 유저: 20:00만, 끊긴 다음날부터 3일까지. 어제가 비어 있으므로 gap 은 2 이상.
            if (slot == Slot.NIGHT) return null
            return when (ChronoUnit.DAYS.between(lastStudyDate, today)) {
                2L -> StreakReminderMessage("오늘 카드 한 장으로 다시 시작해요", "어제 끊긴 연속 학습을 오늘 1일째부터 다시 쌓아요")
                3L, LAPSED_MAX_GAP_DAYS -> StreakReminderMessage("오늘 다시 시작해볼까요?", "카드 한 장만 넘기면 연속 학습 1일째예요")
                else -> null
            }
        }
    }
}
