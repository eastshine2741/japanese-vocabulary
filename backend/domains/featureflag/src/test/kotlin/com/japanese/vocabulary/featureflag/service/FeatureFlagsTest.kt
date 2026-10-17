package com.japanese.vocabulary.featureflag.service

import com.japanese.vocabulary.featureflag.entity.FeatureFlagEntity
import com.japanese.vocabulary.featureflag.repository.FeatureFlagRepository
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

class FeatureFlagsTest {
    private val start = Instant.parse("2026-10-20T00:00:00Z")
    private val end = Instant.parse("2026-10-27T00:00:00Z")
    private val repository = mockk<FeatureFlagRepository>()

    private fun flagsAt(now: Instant) = FeatureFlags(repository, Clock.fixed(now, ZoneOffset.UTC))

    @Test
    fun `flag is on from start inclusive to end exclusive`() {
        every { repository.findAll() } returns listOf(FeatureFlagEntity("new-home", start, end))

        assertThat(flagsAt(start.minusSeconds(1)).isOn("new-home")).isFalse()
        assertThat(flagsAt(start).isOn("new-home")).isTrue()
        assertThat(flagsAt(end.minusSeconds(1)).isOn("new-home")).isTrue()
        assertThat(flagsAt(end).isOn("new-home")).isFalse()
    }

    @Test
    fun `missing start keeps the flag off and missing end keeps it on`() {
        every { repository.findAll() } returns listOf(
            FeatureFlagEntity("parked", null, null),
            FeatureFlagEntity("forever", start, null),
        )
        val flags = flagsAt(end.plusSeconds(365L * 24 * 3600))

        assertThat(flags.isOn("parked")).isFalse()
        assertThat(flags.isOn("forever")).isTrue()
    }

    @Test
    fun `unknown key and load failure are off`() {
        every { repository.findAll() } returns emptyList()
        assertThat(flagsAt(start).isOn("unknown")).isFalse()

        every { repository.findAll() } throws IllegalStateException("db down")
        assertThat(flagsAt(start).isOn("unknown")).isFalse()
    }

    @Test
    fun `flags are read once until invalidated`() {
        every { repository.findAll() } returns listOf(FeatureFlagEntity("new-home", start, null))
        val flags = flagsAt(start)

        repeat(3) { flags.isOn("new-home") }
        verify(exactly = 1) { repository.findAll() }

        every { repository.findAll() } returns emptyList()
        flags.invalidate()
        assertThat(flags.isOn("new-home")).isFalse()
    }
}
