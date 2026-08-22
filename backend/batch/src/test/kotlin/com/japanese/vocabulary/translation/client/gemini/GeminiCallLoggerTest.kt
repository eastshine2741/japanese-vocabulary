package com.japanese.vocabulary.translation.client.gemini

import com.japanese.vocabulary.test.BatchBaseIntegrationTest
import com.japanese.vocabulary.translation.repository.GeminiCallLogRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired

class GeminiCallLoggerTest : BatchBaseIntegrationTest() {

    @Autowired private lateinit var geminiCallLogger: GeminiCallLogger
    @Autowired private lateinit var geminiCallLogRepository: GeminiCallLogRepository

    @Test
    fun `records a call payload against its lyric`() {
        geminiCallLogger.record(
            context = GeminiCallContext(songId = 7L, lyricId = 11L),
            call = "select",
            model = "gemini-test",
            requestJson = """[{"index":0,"segments":[{"surface":"前"}]}]""",
            responseJson = """{"candidates":[{"finishReason":"STOP"}]}""",
            errorMessage = null,
        )

        val saved = geminiCallLogRepository.findAll().single()
        assertThat(saved.songId).isEqualTo(7L)
        assertThat(saved.lyricId).isEqualTo(11L)
        assertThat(saved.callName).isEqualTo("select")
        assertThat(saved.requestJson).contains("前")
        assertThat(saved.responseJson).contains("STOP")
        assertThat(saved.createdAt).isNotNull()
    }
}
