package com.japanese.vocabulary.studystats.util

import org.springframework.stereotype.Component
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
class KstClock {
    fun toStudyDate(instant: Instant): LocalDate =
        instant.atZone(ZONE).minusHours(DAY_START_HOUR.toLong()).toLocalDate()

    fun todayStudyDate(): LocalDate = toStudyDate(Instant.now())

    fun nowKst(): ZonedDateTime = ZonedDateTime.now(ZONE)

    companion object {
        private val ZONE: ZoneId = ZoneId.of("Asia/Seoul")
        private const val DAY_START_HOUR = 4
    }
}
