package com.japanese.vocabulary.test

import com.google.firebase.messaging.FirebaseMessaging
import com.japanese.vocabulary.auth.service.GoogleOidcService
import com.japanese.vocabulary.song.client.itunes.ItunesClient
import com.japanese.vocabulary.song.client.lrclib.LrclibClient
import com.japanese.vocabulary.song.client.vocadb.VocadbClient
import com.japanese.vocabulary.song.client.youtube.YoutubeClient
import com.japanese.vocabulary.song.service.YoutubeMvSearchService
import com.ninjasquad.springmockk.MockkBean
import io.mockk.clearMocks
import org.junit.jupiter.api.BeforeEach

/**
 * api 모듈 통합테스트 부모. 외부 클라이언트(WebClient 기반)는 부모에서 일괄 mock 해
 * ApplicationContext cache key 를 안정화한다. relaxed=false 이므로 자식 테스트는
 * 사용하는 메서드를 명시적으로 stub 해야 한다 — 모르게 부수효과를 호출했을 때 즉시
 * 빨간불이 뜨도록 의도된 정책.
 */
abstract class ApiBaseIntegrationTest : BaseIntegrationTest() {

    @MockkBean
    protected lateinit var lrclibClient: LrclibClient

    @MockkBean
    protected lateinit var vocadbClient: VocadbClient

    @MockkBean
    protected lateinit var youtubeClient: YoutubeClient

    @MockkBean
    protected lateinit var youtubeMvSearchService: YoutubeMvSearchService

    @MockkBean
    protected lateinit var itunesClient: ItunesClient

    @MockkBean
    protected lateinit var googleOidcService: GoogleOidcService

    /**
     * notification 도메인의 `PushNotificationService` 가 `FirebaseMessaging` 빈을 요구하지만
     * `FirebaseConfig` 는 `push.firebase.enabled=true` 게이트 뒤에 있어 테스트에선 안 뜬다.
     * DI 만족용 mock — strict 이므로 실수로 호출되면 즉시 실패한다. (BatchBaseIntegrationTest 와 동일)
     */
    @MockkBean
    protected lateinit var firebaseMessaging: FirebaseMessaging

    @BeforeEach
    fun resetClientMocks() {
        clearMocks(
            lrclibClient, vocadbClient, youtubeClient, youtubeMvSearchService, itunesClient,
            googleOidcService, firebaseMessaging,
            answers = true,
            recordedCalls = true,
        )
    }
}
