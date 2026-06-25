package com.japanese.vocabulary.test

import com.google.firebase.messaging.FirebaseMessaging
import com.japanese.vocabulary.auth.service.GoogleOidcService
import com.japanese.vocabulary.songsearch.client.itunes.ItunesClient
import com.ninjasquad.springmockk.MockkBean
import io.mockk.clearMocks
import org.junit.jupiter.api.BeforeEach

/**
 * AFTER_COMMIT 리스너 직접 호출 테스트의 api 모듈 버전. 도메인 로직 통합테스트는 도메인
 * 모듈이 아니라 bootstrap 모듈(api/batch)에 둔다 — 도메인 모듈에 TestBoot 를 만들면
 * repo/entity 스캔 범위가 부트클래스 패키지로 좁아져 cross-domain 빈이 unresolved 된다.
 *
 * MockkBean 세트는 [ApiBaseIntegrationTest] 와 의도적으로 동일하게 유지할 것 — 세트가
 * 같아야 ApplicationContext cache key 가 일치해서 api 테스트 전체가 컨텍스트 하나를
 * 공유한다. 달라지면 컨텍스트가 한 번 더 뜬다.
 */
abstract class ApiAfterCommitListenerTest : AfterCommitListenerTest() {

    @MockkBean
    protected lateinit var itunesClient: ItunesClient

    @MockkBean
    protected lateinit var googleOidcService: GoogleOidcService

    @MockkBean
    protected lateinit var firebaseMessaging: FirebaseMessaging

    @BeforeEach
    fun resetClientMocks() {
        clearMocks(
            itunesClient, googleOidcService, firebaseMessaging,
            answers = true,
            recordedCalls = true,
        )
    }
}
