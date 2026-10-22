package com.japanese.vocabulary.translation.client.gemini

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.japanese.vocabulary.observability.MetricNames
import com.japanese.vocabulary.translation.client.LlmCostMeter
import com.japanese.vocabulary.translation.client.LlmPricingProperties
import com.japanese.vocabulary.translation.client.LlmPricingProperties.ModelPrice
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import io.mockk.mockk
import kotlinx.coroutines.runBlocking
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.within
import org.junit.jupiter.api.Test
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.anything
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.RestClient
import java.time.Duration

class GeminiClientUsageTest {

    private val meterRegistry = SimpleMeterRegistry()

    @Test
    fun `bills cached prompt tokens at the cached price and thoughts at the output price`() {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        server.expect(anything()).andRespond(withSuccess(RESPONSE, MediaType.APPLICATION_JSON))
        val context = GeminiCallContext(songId = 1, lyricId = 1)

        runBlocking { client(builder).translateLyrics(listOf(mapOf("index" to 0, "text" to "恋")), context) }

        // (1000 - 400) × 2 + 400 × 0.2 + (100 + 50) × 12, per million
        assertThat(meterRegistry.get(MetricNames.LLM_COST).counter().count()).isCloseTo(0.00308, within(1e-12))
        fun tokens(kind: String) = meterRegistry.get(MetricNames.GEMINI_TOKENS).tag("kind", kind).counter().count()
        assertThat(tokens("prompt")).isEqualTo(1000.0)
        assertThat(tokens("candidates")).isEqualTo(100.0)
        assertThat(tokens("thoughts")).isEqualTo(50.0)
        assertThat(tokens("cached")).isEqualTo(400.0)
        assertThat(meterRegistry.find(MetricNames.GEMINI_TOKENS).tag("kind", "total").counters()).isEmpty()
    }

    private fun client(builder: RestClient.Builder) = GeminiClient(
        restClientBuilder = builder,
        apiKey = "key",
        translationModel = "pro",
        wordMeaningModel = "flash",
        segmentationModel = "flash",
        maxOutputTokens = 0,
        segmentationThinkingLevel = "",
        maxAttempts = 1,
        initialBackoff = Duration.ZERO,
        objectMapper = ObjectMapper().registerKotlinModule(),
        meterRegistry = meterRegistry,
        geminiCallLogger = mockk(relaxed = true),
        llmCostMeter = LlmCostMeter(
            LlmPricingProperties(mapOf("pro" to ModelPrice(input = 2.0, output = 12.0, cachedInput = 0.2))),
            meterRegistry,
        ),
    )

    private companion object {
        val RESPONSE = """
            {"candidates":[{"content":{"parts":[{"text":"[{\"index\":0,\"koreanLyrics\":\"사랑\"}]"}]},"finishReason":"STOP"}],
             "usageMetadata":{"promptTokenCount":1000,"cachedContentTokenCount":400,"candidatesTokenCount":100,
                              "thoughtsTokenCount":50,"totalTokenCount":1150}}
        """.trimIndent()
    }
}
