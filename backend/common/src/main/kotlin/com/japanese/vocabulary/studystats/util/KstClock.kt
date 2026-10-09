package com.japanese.vocabulary.studystats.util

import org.springframework.stereotype.Component
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime

/**
 * Maps wall-clock time to a "study date" using a 04:00 KST day boundary.
 * Reviews submitted before 04:00 KST count toward the previous calendar date —
 * giving night-owl learners until 04:00 to extend their streak.
 */
@Component
class KstClock(private val clock: Clock) {
    fun toStudyDate(instant: Instant): LocalDate =
        instant.atZone(ZONE).minusHours(DAY_START_HOUR.toLong()).toLocalDate()

    fun todayStudyDate(): LocalDate = toStudyDate(Instant.now(clock))

    /** [studyDate]가 끝나는 순간 (다음 날 04:00 KST). 이 시각이 지나면 그날 학습으로 치지 않는다. */
    fun endOf(studyDate: LocalDate): Instant =
        studyDate.plusDays(1).atTime(DAY_START_HOUR, 0).atZone(ZONE).toInstant()

    fun nowKst(): ZonedDateTime = ZonedDateTime.now(clock.withZone(ZONE))

    companion object {
        private val ZONE: ZoneId = ZoneId.of("Asia/Seoul")
        private const val DAY_START_HOUR = 4
    }
}
