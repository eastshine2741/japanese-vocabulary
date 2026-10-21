package com.japanese.vocabulary.user

import com.japanese.vocabulary.observability.MetricNames
import com.japanese.vocabulary.test.ApiBaseIntegrationTest
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.user.repository.UserRepository
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import io.mockk.every
import io.mockk.mockk
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import java.time.Instant

class RegisteredUserGaugeTest : ApiBaseIntegrationTest() {

    @Autowired private lateinit var meterRegistry: MeterRegistry
    @Autowired private lateinit var gauge: RegisteredUserGauge

    /** 빈 테스트 DB 에서는 첫 유저가 id 1 이라 운영자 제외도 함께 검증된다. */
    @Test
    fun `counts users who have not withdrawn, except the operator`() {
        gauge.refresh()
        val before = registered(meterRegistry)
        val active = List(2) { TestUserBuilder(entityManager).build() }
        TestUserBuilder(entityManager).build().also {
            it.deletedAt = Instant.now(clock)
            entityManager.flush()
        }

        gauge.refresh()

        assertThat(registered(meterRegistry)).isEqualTo(before + active.count { it.id != 1L })
    }

    @Test
    fun `a failed refresh keeps the last count`() {
        val repository = mockk<UserRepository>()
        every { repository.countByDeletedAtIsNullAndIdNot(any()) } returns 7L andThenThrows IllegalStateException("db down")
        val registry = SimpleMeterRegistry()
        val failing = RegisteredUserGauge(repository).also { it.bindTo(registry) }

        failing.refresh()
        failing.refresh()

        assertThat(registered(registry)).isEqualTo(7.0)
    }

    private fun registered(registry: MeterRegistry): Double = registry.get(MetricNames.USERS_REGISTERED).gauge().value()
}
