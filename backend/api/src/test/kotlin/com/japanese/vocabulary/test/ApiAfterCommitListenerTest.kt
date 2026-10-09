package com.japanese.vocabulary.test

import com.google.firebase.messaging.FirebaseMessaging
import com.japanese.vocabulary.auth.service.AppleOidcService
import com.japanese.vocabulary.auth.service.GoogleOidcService
import com.japanese.vocabulary.songsearch.client.applemusic.AppleMusicClient
import com.ninjasquad.springmockk.MockkBean
import io.mockk.clearMocks
import org.junit.jupiter.api.BeforeEach

/**
 * AFTER_COMMIT 리스너 직접 호출 테스트의 api 모듈 버전.
 * MockkBean 세트는 [ApiBaseIntegrationTest] 와 같아야 ApplicationContext cache key 가 일치해 컨텍스트 하나를 공유한다.
 */
abstract class ApiAfterCommitListenerTest : AfterCommitListenerTest() {

    @MockkBean
    protected lateinit var appleMusicClient: AppleMusicClient

    @MockkBean
    protected lateinit var googleOidcService: GoogleOidcService

    @MockkBean
    protected lateinit var appleOidcService: AppleOidcService

    @MockkBean
    protected lateinit var firebaseMessaging: FirebaseMessaging

    @BeforeEach
    fun resetClientMocks() {
        clearMocks(
            appleMusicClient, googleOidcService, appleOidcService, firebaseMessaging,
            answers = true,
            recordedCalls = true,
        )
    }
}
