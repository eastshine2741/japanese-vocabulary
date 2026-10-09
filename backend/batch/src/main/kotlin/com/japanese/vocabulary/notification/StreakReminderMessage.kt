package com.japanese.vocabulary.notification

import java.time.LocalDate
import java.time.temporal.ChronoUnit

/**
 * 연속 학습 알림 문구. 발송 대상 판정은 [StreakReminderTask]가 하고, 보내지 않는 조합은 null.
 */
data class StreakReminderMessage(val title: String, val body: String) {

    enum class Slot { EVENING, NIGHT }

    companion object {
        /** 끊긴 유저에게 마지막(작별) 알림을 보내는 날. 마지막 학습일로부터 며칠 지났는지 기준. */
        private const val LAPSED_MAX_GAP_DAYS = 4L

        /**
         * @param streak 어제까지 이어진 연속 일수 (오늘 미학습 시점의 currentStreak). 0이면 끊김.
         * @param lastStudyDate 마지막 학습일. streak == 0 일 때만 본다.
         * @param name 유저 표시 이름. 문구가 "OO님"으로 부른다.
         */
        fun compose(slot: Slot, streak: Int, lastStudyDate: LocalDate, today: LocalDate, name: String): StreakReminderMessage? {
            if (streak >= 1) {
                return when (slot) {
                    Slot.EVENING -> StreakReminderMessage("👀 ${name}님...?", "아직 오늘의 복습을 하지 않으셨네요. 그냥 그렇다고요.")
                    Slot.NIGHT -> StreakReminderMessage("😱 조심하세요!!", "단어 하나만 공부해도 ${streak}일 연속이 유지돼요")
                }
            }

            // 끊긴 유저: 20:00만. 끊긴 다음날(gap 2)과 마지막 작별(gap 4) 두 번. 어제가 비어 있으므로 gap 은 2 이상.
            if (slot == Slot.NIGHT) return null
            return when (ChronoUnit.DAYS.between(lastStudyDate, today)) {
                2L -> StreakReminderMessage("어제는 좀 피곤했던 거죠?", "새 마음으로 다시 시작해봐요!!")
                LAPSED_MAX_GAP_DAYS -> StreakReminderMessage("마지막으로 한 번만 부를게요.", "제가 너무 귀찮게 했나 봐요. 마음이 바뀌면 단어 한 장으로 돌아와 주세요")
                else -> null
            }
        }
    }
}
