package com.japanese.vocabulary.test

import com.google.firebase.messaging.FirebaseMessaging
import com.japanese.vocabulary.auth.service.AppleOidcService
import com.japanese.vocabulary.auth.service.GoogleOidcService
import com.japanese.vocabulary.featureflag.entity.FeatureFlagEntity
import com.japanese.vocabulary.featureflag.repository.FeatureFlagRepository
import com.japanese.vocabulary.featureflag.service.FeatureFlags
import com.japanese.vocabulary.github.client.GithubIssueClient
import com.japanese.vocabulary.objectstorage.client.ObjectStorageClient
import com.japanese.vocabulary.songsearch.client.applemusic.AppleMusicClient
import com.ninjasquad.springmockk.MockkBean
import io.mockk.clearMocks
import org.junit.jupiter.api.BeforeEach
import org.springframework.beans.factory.annotation.Autowired
import java.time.Instant

/**
 * api 모듈 통합테스트 부모. 외부 클라이언트를 여기서 일괄 mock 해 ApplicationContext cache key 를 안정화한다.
 * relaxed=false 라 자식 테스트는 쓰는 메서드를 명시적으로 stub 해야 한다.
 */
abstract class ApiBaseIntegrationTest : BaseIntegrationTest() {

    @MockkBean
    protected lateinit var appleMusicClient: AppleMusicClient

    @MockkBean
    protected lateinit var googleOidcService: GoogleOidcService

    @MockkBean
    protected lateinit var appleOidcService: AppleOidcService

    @MockkBean
    protected lateinit var githubIssueClient: GithubIssueClient

    @MockkBean
    protected lateinit var objectStorageClient: ObjectStorageClient

    /**
     * `PushNotificationService` 가 요구하는 `FirebaseMessaging` 빈은 `push.firebase.enabled=true` 게이트 뒤라
     * 테스트에선 안 뜬다. DI 만족용 strict mock.
     */
    @MockkBean
    protected lateinit var firebaseMessaging: FirebaseMessaging

    @Autowired
    private lateinit var featureFlags: FeatureFlags

    @Autowired
    private lateinit var featureFlagRepository: FeatureFlagRepository

    @BeforeEach
    fun resetClientMocks() {
        clearMocks(
            appleMusicClient, googleOidcService, appleOidcService, githubIssueClient, objectStorageClient, firebaseMessaging,
            answers = true,
            recordedCalls = true,
        )
        featureFlags.invalidate()
    }

    /** 테스트 트랜잭션 안에서 켜므로 롤백과 함께 사라진다. 플래그 캐시는 bean 이라 테스트마다 비운다. */
    protected fun turnOn(flagKey: String) {
        featureFlagRepository.saveAndFlush(FeatureFlagEntity(key = flagKey, startAt = Instant.EPOCH))
        featureFlags.invalidate()
    }

    protected fun turnOff(flagKey: String) {
        featureFlagRepository.deleteById(flagKey)
        featureFlagRepository.flush()
        featureFlags.invalidate()
    }
}
