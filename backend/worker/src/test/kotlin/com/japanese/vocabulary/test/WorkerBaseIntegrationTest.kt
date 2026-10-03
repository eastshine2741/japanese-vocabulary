package com.japanese.vocabulary.test

import com.google.firebase.messaging.FirebaseMessaging
import com.japanese.vocabulary.lyricsearch.lrclib.LrclibClient
import com.japanese.vocabulary.lyricsearch.vocadb.VocadbClient
import com.japanese.vocabulary.messagequeue.SongAnalysisWorkQueuePublisher
import com.japanese.vocabulary.mvsearch.client.youtube.YoutubeClient
import com.japanese.vocabulary.translation.client.gemini.GeminiClient
import com.japanese.vocabulary.translation.client.jev.JevClient
import com.japanese.vocabulary.translation.client.jev.dto.JevAnswer
import com.japanese.vocabulary.translation.client.jev.dto.JevChoiceQuestion
import com.japanese.vocabulary.translation.service.JishoService
import com.ninjasquad.springmockk.MockkBean
import io.mockk.clearMocks
import io.mockk.coEvery
import org.junit.jupiter.api.BeforeEach

abstract class WorkerBaseIntegrationTest : BaseIntegrationTest() {

    @MockkBean
    protected lateinit var geminiClient: GeminiClient

    @MockkBean
    protected lateinit var jevClient: JevClient

    @MockkBean
    protected lateinit var jishoService: JishoService

    @MockkBean
    protected lateinit var lrclibClient: LrclibClient

    @MockkBean
    protected lateinit var vocadbClient: VocadbClient

    @MockkBean
    protected lateinit var youtubeClient: YoutubeClient

    /** 브로커 없이 컨텍스트를 띄운다. 발행 자체는 통합 테스트 대상이 아니다. */
    @MockkBean(relaxed = true)
    protected lateinit var songAnalysisWorkQueuePublisher: SongAnalysisWorkQueuePublisher

    /**
     * `PushNotificationService` requires a `FirebaseMessaging` bean, but tests don't load
     * `FirebaseConfig` (it's gated on `push.firebase.enabled=true` and would need real credentials).
     * The mock exists only to satisfy DI; no integration test currently invokes `send()`. Kept
     * strict so an accidental future invocation surfaces loudly rather than silently no-op'ing.
     */
    @MockkBean
    protected lateinit var firebaseMessaging: FirebaseMessaging

    @BeforeEach
    fun resetExternalApiMocks() {
        clearMocks(
            geminiClient,
            jevClient,
            jishoService,
            lrclibClient,
            vocadbClient,
            youtubeClient,
            answers = true,
            recordedCalls = true,
        )
    }

    /**
     * Sense-select answers every question with its first offered sense at full confidence. Each
     * request's questions (tokenId -> question) are appended to [requests] when given.
     */
    protected fun stubJevPicksFirstOffered(requests: MutableList<Map<String, JevChoiceQuestion>>? = null) {
        coEvery { jevClient.choose(any(), any(), any(), any()) } answers {
            val questions = thirdArg<Map<String, JevChoiceQuestion>>()
            requests?.add(questions)
            questions.mapValues { (_, question) -> JevAnswer(question.criteria.keys.first(), 1.0) }
        }
    }
}
