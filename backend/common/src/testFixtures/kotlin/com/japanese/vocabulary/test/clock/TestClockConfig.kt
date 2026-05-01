package com.japanese.vocabulary.test.clock

import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Primary
import java.time.Instant

@TestConfiguration
class TestClockConfig {

    @Bean
    @Primary
    fun clock(): MutableClock = MutableClock(DEFAULT_FIXED_INSTANT)

    companion object {
        val DEFAULT_FIXED_INSTANT: Instant = Instant.parse("2026-01-01T00:00:00Z")
    }
}
