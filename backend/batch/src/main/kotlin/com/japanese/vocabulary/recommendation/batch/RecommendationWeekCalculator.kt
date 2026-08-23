package com.japanese.vocabulary.recommendation.batch

import org.springframework.stereotype.Component
import java.time.Clock
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.TemporalAdjusters

@Component
class RecommendationWeekCalculator(private val clock: Clock) {
    fun currentWeekStartDate(): LocalDate = weekStartDate(Instant.now(clock))

    fun weekStartDate(instant: Instant): LocalDate =
        instant.atZone(JAPAN_ZONE).toLocalDate()
            .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))

    companion object {
        val JAPAN_ZONE: ZoneId = ZoneId.of("Asia/Tokyo")
    }
}
