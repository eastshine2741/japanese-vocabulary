package com.japanese.vocabulary.test

import com.japanese.vocabulary.test.clock.TestClockConfig
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Duration

/**
 * Phase 1 인프라 스모크: Spring 컨텍스트 부팅 + Flyway 마이그레이션 적용 + Testcontainers MySQL 연결 +
 * 빌더 영속화 + truncate 격리 + MutableClock 주입을 한 번에 검증한다.
 */
class InfrastructureSmokeTest : ApiBaseIntegrationTest() {

    @Test
    fun `context boots, builder persists, clock starts at fixed instant`() {
        val user = TestUserBuilder(entityManager, transactionTemplate)
            .withName("smoke-${System.nanoTime()}")
            .build()

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
    fun `truncate isolates state between tests`() {
        // Given: prior tests may have inserted users; @BeforeEach truncates before this runs.
        val countBefore = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM users", Long::class.java)

        // When: insert one user
        TestUserBuilder(entityManager, transactionTemplate).build()

        // Then: count grew from a clean baseline
        val countAfter = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM users", Long::class.java)
        assertThat(countBefore).isEqualTo(0L)
        assertThat(countAfter).isEqualTo(1L)
    }
}
