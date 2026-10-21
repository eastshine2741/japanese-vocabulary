package com.japanese.vocabulary.translation.client

import com.japanese.vocabulary.observability.MetricNames
import com.japanese.vocabulary.translation.client.LlmPricingProperties.ModelPrice
import com.japanese.vocabulary.translation.client.gemini.GeminiCallContext
import io.micrometer.core.instrument.simple.SimpleMeterRegistry
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.within
import org.junit.jupiter.api.Test
import java.util.concurrent.atomic.DoubleAdder

class LlmCostMeterTest {

    private val meterRegistry = SimpleMeterRegistry()
    private val meter = LlmCostMeter(
        LlmPricingProperties(mapOf("pro" to ModelPrice(input = 2.0, output = 12.0, cachedInput = 0.2))),
        meterRegistry,
    )

    @Test
    fun `prices each token kind per million`() {
        // 1M uncached input × 2 + 0.5M output × 12 + 1M cached × 0.2
        assertThat(meter.costUsd("pro", 1_000_000, 500_000, 1_000_000)).isCloseTo(8.2, within(1e-9))
    }

    @Test
    fun `adds the cost to the counter and the stage run accumulator`() {
        val accumulator = DoubleAdder()
        val context = GeminiCallContext(songId = null, lyricId = null, workId = 1, stage = "ANALYZE_LYRICS", llmCostUsd = accumulator)

        meter.record("gemini", "translation", "pro", context, inputTokens = 1000, outputTokens = 100)
        meter.record("gemini", "translation", "pro", context, inputTokens = 1000, outputTokens = 100)

        assertThat(accumulator.sum()).isCloseTo(0.0064, within(1e-12))
        val counter = meterRegistry.get(MetricNames.LLM_COST)
            .tag("provider", "gemini")
            .tag("stage", "ANALYZE_LYRICS")
            .tag("call", "translation")
            .tag("model", "pro")
            .counter()
        assertThat(counter.count()).isCloseTo(0.0064, within(1e-12))
    }

    @Test
    fun `a model missing from the price table costs nothing instead of failing`() {
        val accumulator = DoubleAdder()
        val context = GeminiCallContext(songId = null, lyricId = null, llmCostUsd = accumulator)

        meter.record("gemini", "segment", "unknown-model", context, inputTokens = 1000, outputTokens = 100)

        assertThat(accumulator.sum()).isZero()
        assertThat(meterRegistry.find(MetricNames.LLM_COST).counters()).isEmpty()
    }
}
