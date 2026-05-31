package com.japanese.vocabulary.test

import com.japanese.vocabulary.song.client.gemini.GeminiClient
import com.ninjasquad.springmockk.MockkBean
import io.mockk.clearMocks
import org.junit.jupiter.api.BeforeEach

abstract class BatchBaseIntegrationTest : BaseIntegrationTest() {

    @MockkBean
    protected lateinit var geminiClient: GeminiClient

    @BeforeEach
    fun resetGeminiMock() {
        clearMocks(geminiClient, answers = true, recordedCalls = true)
    }
}
