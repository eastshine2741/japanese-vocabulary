package com.japanese.vocabulary.translation.client

import com.japanese.vocabulary.observability.MetricNames
import com.japanese.vocabulary.translation.client.gemini.GeminiCallContext
import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.MeterRegistry
import org.slf4j.LoggerFactory
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.stereotype.Component
import java.util.concurrent.ConcurrentHashMap

/** USD per 1M tokens, keyed by model. Spring drops dots in map keys unless quoted as `"[gemini-3.1-pro-preview]"`. */
@ConfigurationProperties(prefix = "kotonoha.llm")
data class LlmPricingProperties(
    val pricing: Map<String, ModelPrice> = emptyMap(),
) {
    data class ModelPrice(
        val input: Double = 0.0,
        val output: Double = 0.0,
        val cachedInput: Double = 0.0,
    )
}

/**
 * Adds one call's cost to the counter and to the stage run's accumulator ([GeminiCallContext.llmCostUsd]).
 * A model missing from the price table must not fail analysis, so it costs 0 and warns once per model.
 */
@Component
class LlmCostMeter(
    private val properties: LlmPricingProperties,
    private val meterRegistry: MeterRegistry,
) {
    private val logger = LoggerFactory.getLogger(LlmCostMeter::class.java)
    private val warnedModels = ConcurrentHashMap.newKeySet<String>()

    fun record(
        provider: String,
        call: String,
        model: String,
        context: GeminiCallContext,
        inputTokens: Long,
        outputTokens: Long = 0,
        cachedInputTokens: Long = 0,
    ) {
        val usd = costUsd(model, inputTokens, outputTokens, cachedInputTokens)
        if (usd <= 0.0) return
        context.llmCostUsd?.add(usd)
        Counter.builder(MetricNames.LLM_COST)
            .tag("provider", provider)
            .tag("stage", context.stageTag)
            .tag("call", call)
            .tag("model", model)
            .register(meterRegistry)
            .increment(usd)
    }

    fun costUsd(model: String, inputTokens: Long, outputTokens: Long, cachedInputTokens: Long): Double {
        val price = properties.pricing[model]
        if (price == null) {
            if (warnedModels.add(model)) logger.warn("No LLM price for model={}; recording its cost as 0", model)
            return 0.0
        }
        return (inputTokens * price.input + outputTokens * price.output + cachedInputTokens * price.cachedInput) / 1_000_000
    }
}
