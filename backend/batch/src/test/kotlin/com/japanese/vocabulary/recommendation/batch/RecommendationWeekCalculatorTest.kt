package com.japanese.vocabulary.recommendation.batch

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

class RecommendationWeekCalculatorTest {
    private val calculator = RecommendationWeekCalculator(Clock.fixed(Instant.parse("2026-06-25T00:00:00Z"), ZoneOffset.UTC))

    @Test
    fun `calculates Monday week start in Japan timezone`() {
        val result = calculator.weekStartDate(Instant.parse("2026-06-25T12:00:00Z"))

        assertThat(result).isEqualTo(LocalDate.of(2026, 6, 22))
    }

    @Test
    fun `uses previous Monday when UTC Sunday is already Monday in Japan`() {
        val result = calculator.weekStartDate(Instant.parse("2026-06-28T15:30:00Z"))

        assertThat(result).isEqualTo(LocalDate.of(2026, 6, 29))
    }
}
