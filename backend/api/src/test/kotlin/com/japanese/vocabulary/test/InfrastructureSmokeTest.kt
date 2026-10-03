package com.japanese.vocabulary.test

import com.japanese.vocabulary.test.clock.TestClockConfig
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Duration

class InfrastructureSmokeTest : ApiBaseIntegrationTest() {

    @Test
    fun `context boots, builder persists, clock starts at fixed instant`() {
        val user = TestUserBuilder(entityManager).build()

        assertThat(user.id).isNotNull()
        assertThat(clock.instant()).isEqualTo(TestClockConfig.DEFAULT_FIXED_INSTANT)
    }

    @Test
    fun `clock advance is observable in same context`() {
        val before = clock.instant()
        clock.advance(Duration.ofDays(1))

        assertThat(clock.instant()).isEqualTo(before.plus(Duration.ofDays(1)))
    }

    @Test
    fun `each test starts from clean rollback baseline`() {
        val countBefore = entityManager.createQuery("SELECT COUNT(u) FROM UserEntity u", Long::class.javaObjectType)
            .singleResult
        TestUserBuilder(entityManager).build()
        val countAfter = entityManager.createQuery("SELECT COUNT(u) FROM UserEntity u", Long::class.javaObjectType)
            .singleResult

        assertThat(countBefore).isEqualTo(0L)
        assertThat(countAfter).isEqualTo(1L)
    }
}
