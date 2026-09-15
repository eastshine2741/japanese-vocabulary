package com.japanese.vocabulary.translation.client.gemini

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.japanese.vocabulary.common.retry.TransientHttpErrors
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import io.mockk.every
import io.mockk.mockk
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.test.web.client.ExpectedCount
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.anything
import org.springframework.test.web.client.response.MockRestResponseCreators.withStatus
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.test.web.client.response.MockRestResponseCreators.withException
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.HttpServerErrorException
import org.springframework.web.client.ResourceAccessException
import org.springframework.web.client.RestClient
import java.io.IOException
import java.time.Duration

class GeminiClientRetryTest {

    private val context = GeminiCallContext(songId = 1, lyricId = 1)

    @Test
    fun `retries a dropped connection and returns the later success`() {
        val (client, server) = clientWith { server ->
            server.expect(anything()).andRespond(withException(IOException("failed to respond")))
            server.expect(anything()).andRespond(success())
        }

        val lines = client.translateLyrics(input(), context)

        assertThat(lines.single().koreanLyrics).isEqualTo("사랑")
        server.verify()
    }

    @Test
    fun `retries a 5xx`() {
        val (client, server) = clientWith { server ->
            server.expect(anything()).andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE))
            server.expect(anything()).andRespond(success())
        }

        client.translateLyrics(input(), context)

        server.verify()
    }

    @Test
    fun `gives up after the configured attempts`() {
        val (client, server) = clientWith(maxAttempts = 3) { server ->
            server.expect(ExpectedCount.times(3), anything()).andRespond(withStatus(HttpStatus.BAD_GATEWAY))
        }

        assertThatThrownBy { client.translateLyrics(input(), context) }
            .isInstanceOf(HttpServerErrorException::class.java)
        server.verify()
    }

    @Test
    fun `does not retry a 4xx`() {
        val (client, server) = clientWith { server ->
            server.expect(ExpectedCount.once(), anything()).andRespond(withStatus(HttpStatus.BAD_REQUEST))
        }

        assertThatThrownBy { client.translateLyrics(input(), context) }
            .isInstanceOf(HttpClientErrorException::class.java)
        server.verify()
    }

    @Test
    fun `does not retry a truncated response`() {
        val (client, server) = clientWith { server ->
            server.expect(ExpectedCount.once(), anything())
                .andRespond(withSuccess(response(finishReason = "MAX_TOKENS"), MediaType.APPLICATION_JSON))
        }

        assertThatThrownBy { client.translateLyrics(input(), context) }
            .isInstanceOf(GeminiIncompleteResponseException::class.java)
        server.verify()
    }

    @Test
    fun `a truncated or unparseable answer is not transient`() {
        // The shared policy covers HTTP; these two are Gemini's own verdicts on the answer and must
        // never be replayed — the same input would be cut the same way.
        assertThat(TransientHttpErrors.isTransient(GeminiIncompleteResponseException("cut"))).isFalse()
        assertThat(TransientHttpErrors.isTransient(IllegalStateException("parse"))).isFalse()
    }

    private fun input() = listOf(mapOf("index" to 0, "text" to "恋"))

    private fun success() = withSuccess(response(finishReason = "STOP"), MediaType.APPLICATION_JSON)

    private fun response(finishReason: String) = """
        {"candidates":[{"content":{"parts":[{"text":"[{\"index\":0,\"koreanLyrics\":\"사랑\"}]"}]},"finishReason":"$finishReason"}]}
    """.trimIndent()

    private fun clientWith(
        maxAttempts: Int = 3,
        expectations: (MockRestServiceServer) -> Unit,
    ): Pair<GeminiClient, MockRestServiceServer> {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        expectations(server)
        val client = GeminiClient(
            restClientBuilder = builder,
            apiKey = "key",
            translationModel = "pro",
            wordMeaningModel = "flash",
            segmentationModel = "flash",
            maxOutputTokens = 0,
            segmentationThinkingLevel = "",
            maxAttempts = maxAttempts,
            initialBackoff = Duration.ZERO,
            objectMapper = ObjectMapper().registerKotlinModule(),
            meterRegistry = SimpleMeterRegistry(),
            geminiCallLogger = mockk<GeminiCallLogger>().also { every { it.record(any(), any(), any(), any(), any(), any()) } returns Unit },
        )
        return client to server
    }
}
