package com.japanese.vocabulary.user

import com.japanese.vocabulary.observability.MetricNames
import com.japanese.vocabulary.test.ApiBaseIntegrationTest
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import io.micrometer.core.instrument.MeterRegistry
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import java.time.Instant

class RegisteredUserGaugeTest : ApiBaseIntegrationTest() {

    @Autowired private lateinit var meterRegistry: MeterRegistry

    @Test
    fun `counts users who have not withdrawn, except the operator`() {
        val before = registered(meterRegistry)
        // auto-increment 는 롤백돼도 되감기지 않아 TestUserBuilder 로는 id 1 이 나온다는 보장이 없다.
        entityManager.createNativeQuery(
            "INSERT INTO users (id, provider, provider_sub, username, name) VALUES (1, 'test', 'operator-seed', 'operator-seed', '운영자') " +
                "ON DUPLICATE KEY UPDATE deleted_at = NULL",
        ).executeUpdate()
        val active = List(2) { TestUserBuilder(entityManager).build() }
        TestUserBuilder(entityManager).build().also {
            it.deletedAt = Instant.now(clock)
            entityManager.flush()
        }

        assertThat(registered(meterRegistry)).isEqualTo(before + active.size)
    }

    private fun registered(registry: MeterRegistry): Double = registry.get(MetricNames.USERS_REGISTERED).gauge().value()
}
