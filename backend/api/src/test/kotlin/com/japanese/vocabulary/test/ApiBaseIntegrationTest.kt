package com.japanese.vocabulary.test

import com.japanese.vocabulary.auth.service.GoogleOidcService
import com.japanese.vocabulary.song.client.itunes.ItunesClient
import com.japanese.vocabulary.song.client.lrclib.LrclibClient
import com.japanese.vocabulary.song.client.vocadb.VocadbClient
import com.japanese.vocabulary.song.client.youtube.YoutubeClient
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
    protected lateinit var itunesClient: ItunesClient

    @MockkBean
    protected lateinit var googleOidcService: GoogleOidcService

    @BeforeEach
    fun resetClientMocks() {
        clearMocks(
            lrclibClient, vocadbClient, youtubeClient, itunesClient, googleOidcService,
            answers = true,
            recordedCalls = true,
        )
    }
}
