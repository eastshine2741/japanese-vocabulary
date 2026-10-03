package com.japanese.vocabulary.test

import com.google.firebase.messaging.FirebaseMessaging
import com.japanese.vocabulary.lyricsearch.lrclib.LrclibClient
import com.japanese.vocabulary.lyricsearch.vocadb.VocadbClient
import com.japanese.vocabulary.mvsearch.client.youtube.YoutubeClient
import com.japanese.vocabulary.translation.client.gemini.GeminiClient
import com.japanese.vocabulary.translation.client.jev.JevClient
import com.japanese.vocabulary.translation.client.jev.dto.JevAnswer
import com.japanese.vocabulary.translation.client.jev.dto.JevChoiceQuestion
import com.japanese.vocabulary.translation.service.JishoService
import com.ninjasquad.springmockk.MockkBean
import io.mockk.clearMocks
import io.mockk.every
import org.junit.jupiter.api.BeforeEach

abstract class BatchBaseIntegrationTest : BaseIntegrationTest() {

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

    /**
     * Satisfies `PushNotificationService`'s DI: `FirebaseConfig` is gated on
     * `push.firebase.enabled=true` and not loaded in tests. Kept strict so an unexpected `send()` fails loudly.
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
        every { jevClient.choose(any(), any(), any(), any()) } answers {
            val questions = thirdArg<Map<String, JevChoiceQuestion>>()
            requests?.add(questions)
            questions.mapValues { (_, question) -> JevAnswer(question.criteria.keys.first(), 1.0) }
        }
    }
}
