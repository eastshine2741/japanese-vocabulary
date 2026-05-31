package com.japanese.vocabulary.test

import com.japanese.vocabulary.song.client.gemini.GeminiClient
import com.ninjasquad.springmockk.MockkBean
import io.mockk.clearMocks
import org.junit.jupiter.api.BeforeEach

/**
 * batch 모듈 통합테스트 부모. 외부 호출인 GeminiClient 는 부모에서 일괄 mock —
 * relaxed=false 이므로 실제로 호출하는 테스트만 명시적으로 stub 한다.
 *
 * @Transactional rollback 격리는 [BaseIntegrationTest] 에서 상속받는다. 잡 step 을
 * JobLauncher 로 실행하면 자체 트랜잭션을 commit 하므로 격리가 깨지지만, 이 테스트들은
 * step 의 비즈니스 서비스(FreezeConsumeService 등)를 직접 호출하므로 outer 트랜잭션에
 * PROPAGATION_REQUIRED 로 join 되어 정상 격리된다.
 */
abstract class BatchBaseIntegrationTest : BaseIntegrationTest() {

    @MockkBean
    protected lateinit var geminiClient: GeminiClient

    @BeforeEach
    fun resetGeminiMock() {
        clearMocks(geminiClient, answers = true, recordedCalls = true)
    }
}
