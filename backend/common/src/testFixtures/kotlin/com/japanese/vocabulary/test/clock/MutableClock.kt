package com.japanese.vocabulary.test.clock

import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId

class MutableClock(
    private var current: Instant,
    private val zone: ZoneId = ZoneId.of("UTC"),
) : Clock() {

    override fun instant(): Instant = current

    override fun getZone(): ZoneId = zone

    override fun withZone(zone: ZoneId): Clock = MutableClock(current, zone)

    fun setTo(instant: Instant) {
        current = instant
    }

    fun advance(duration: Duration) {
        current = current.plus(duration)
    }
}
