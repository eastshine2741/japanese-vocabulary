package com.japanese.vocabulary.test

import com.google.firebase.messaging.FirebaseMessaging
import com.japanese.vocabulary.translation.client.gemini.GeminiClient
import com.ninjasquad.springmockk.MockkBean
import io.mockk.clearMocks
import org.junit.jupiter.api.BeforeEach

abstract class BatchBaseIntegrationTest : BaseIntegrationTest() {

    @MockkBean
    protected lateinit var geminiClient: GeminiClient

    /**
     * `PushNotificationService` requires a `FirebaseMessaging` bean, but tests don't load
     * `FirebaseConfig` (it's gated on `push.firebase.enabled=true` and would need real credentials).
     * The mock exists only to satisfy DI; no integration test currently invokes `send()`. Kept
     * strict so an accidental future invocation surfaces loudly rather than silently no-op'ing.
     */
    @MockkBean
    protected lateinit var firebaseMessaging: FirebaseMessaging

    @BeforeEach
    fun resetGeminiMock() {
        clearMocks(geminiClient, answers = true, recordedCalls = true)
    }
}
