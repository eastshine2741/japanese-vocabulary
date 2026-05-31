package com.japanese.vocabulary.test

import com.japanese.vocabulary.song.client.gemini.GeminiClient
import com.japanese.vocabulary.test.clock.MutableClock
import com.japanese.vocabulary.test.clock.TestClockConfig
import com.ninjasquad.springmockk.MockkBean
import io.mockk.clearMocks
import jakarta.persistence.EntityManager
import org.junit.jupiter.api.BeforeEach
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.ActiveProfiles

/**
 * batch 모듈 통합테스트 부모. @Transactional 은 의도적으로 빼두었다 — Spring Batch 잡은
 * 자체 트랜잭션을 열어 step 단위로 commit 하기 때문에 outer rollback 으로 격리할 수
 * 없다. 데이터 정리는 각 테스트가 @AfterEach 로 직접 비운다.
 *
 * GeminiClient 는 외부 호출이라 부모에서 일괄 mock — relaxed=false 이므로 실제로
 * 호출하는 테스트만 명시적으로 stub 한다.
 */
@SpringBootTest
@ActiveProfiles("test")
@Import(TestcontainersConfig::class, TestClockConfig::class)
abstract class BatchBaseIntegrationTest {

    @Autowired protected lateinit var entityManager: EntityManager
    @Autowired protected lateinit var clock: MutableClock
    @Autowired protected lateinit var jdbcTemplate: JdbcTemplate

    @MockkBean
    protected lateinit var geminiClient: GeminiClient

    @BeforeEach
    fun resetSharedState() {
        clock.setTo(TestClockConfig.DEFAULT_FIXED_INSTANT)
        clearMocks(geminiClient, answers = true, recordedCalls = true)
    }
}
