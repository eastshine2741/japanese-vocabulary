package com.japanese.vocabulary.test

import com.japanese.vocabulary.test.clock.TestClockConfig
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Duration

/**
 * Phase 1 인프라 스모크: Spring 컨텍스트 부팅 + Flyway 마이그레이션 적용 + Testcontainers MySQL 연결 +
 * 빌더 영속화 + MutableClock 주입을 한 번에 검증한다.
 */
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
