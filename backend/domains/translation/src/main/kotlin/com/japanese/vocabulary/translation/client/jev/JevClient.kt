package com.japanese.vocabulary.translation.client.jev

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.common.retry.ExponentialBackoff
import com.japanese.vocabulary.common.retry.currentRetryDeadline
import com.japanese.vocabulary.common.retry.TransientHttpErrors
import com.japanese.vocabulary.observability.MetricNames
import com.japanese.vocabulary.translation.client.gemini.GeminiCallContext
import com.japanese.vocabulary.translation.client.gemini.GeminiCallLogger
import com.japanese.vocabulary.translation.client.jev.dto.JevAnswer
import com.japanese.vocabulary.translation.client.jev.dto.JevChoiceQuestion
import com.japanese.vocabulary.translation.client.jev.dto.JevResponse
import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.MeterRegistry
import io.micrometer.core.instrument.Timer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import java.time.Duration

/**
 * TypeSafe's Jev ("System One") decision model: given [state] and `choice` questions, it answers each
 * with one offered option id plus a confidence, never free text. Input tokens are billed; output is free.
 */
@Component
class JevClient(
    restClientBuilder: RestClient.Builder,
    @Value("\${jev.api-key}") private val apiKey: String,
    @Value("\${jev.model:jev-latest}") private val model: String,
    /**
     * Same policy as the Gemini client: only [TransientHttpErrors.isTransient] failures are retried
     * (Jev's overload status 529 is covered).
     */
    @Value("\${jev.retry.max-attempts:3}") maxAttempts: Int,
    @Value("\${jev.retry.initial-backoff:2s}") initialBackoff: Duration,
    private val objectMapper: ObjectMapper,
    private val meterRegistry: MeterRegistry,
    private val callLogger: GeminiCallLogger,
) {
    private val logger = LoggerFactory.getLogger(JevClient::class.java)
    private val backoff = ExponentialBackoff(maxAttempts, initialBackoff)

    private val restClient = restClientBuilder
        .baseUrl("https://api.typesafe.ai")
        .build()

    /**
     * Asks every question in one request and returns the answers keyed like [questions]. A question
     * Jev left unanswered is simply absent; the caller decides what that means.
     */
    suspend fun choose(
        call: String,
        state: Map<String, Any?>,
        questions: Map<String, JevChoiceQuestion>,
        context: GeminiCallContext,
    ): Map<String, JevAnswer> {
        val requestJson = objectMapper.writeValueAsString(
            mapOf("model" to model, "state" to state, "questions" to questions),
        )
        return backoff.retry(
            isTransient = TransientHttpErrors::isTransient,
            atLeast = TransientHttpErrors::retryAfter,
            onRetry = { attempt, e, delay ->
                logger.warn(
                    "[workId={}] Jev call={} attempt {}/{} failed, retrying in {}ms: {}: {}",
                    context.workId, call, attempt, backoff.maxAttempts, delay.toMillis(), e::class.simpleName, e.message,
                )
                Counter.builder(MetricNames.JEV_CALL_RETRIES)
                    .tag("call", call)
                    .tag("reason", e::class.simpleName ?: "unknown")
                    .register(meterRegistry)
                    .increment()
            },
            deadline = currentRetryDeadline(),
            sleep = { delay(it.toMillis()) },
        ) {
            withContext(Dispatchers.IO) { attempt(call, requestJson, context) }
        }
    }

    /** One HTTP round trip. Every attempt gets its own call-log row and duration sample. */
    private fun attempt(call: String, requestJson: String, context: GeminiCallContext): Map<String, JevAnswer> {
        val sample = Timer.start(meterRegistry)
        var outcome = "success"
        var responseJson: String? = null
        var errorMessage: String? = null
        var answeredBy = model
        try {
            responseJson = restClient.post()
                .uri("/v1/systemone")
                .header("Authorization", "Bearer $apiKey")
                .header("Content-Type", "application/json")
                .body(requestJson)
                .retrieve()
                .body(String::class.java)
                ?: throw RuntimeException("Empty response from Jev API")
            val response = objectMapper.readValue(responseJson, JevResponse::class.java)
            response.model?.let { answeredBy = it }
            response.usage?.let { recordTokens(call, "input", it.inputTokens) }
            return response.answers
        } catch (e: Throwable) {
            outcome = "failure"
            errorMessage = "${e::class.simpleName}: ${e.message}"
            throw e
        } finally {
            // `jev-latest` resolves to a concrete version per response; log that one.
            callLogger.record(context, call, answeredBy, requestJson, responseJson, errorMessage)
            sample.stop(
                Timer.builder(MetricNames.JEV_CALL_DURATION)
                    .tag("call", call)
                    .tag("outcome", outcome)
                    .publishPercentileHistogram()
                    .register(meterRegistry),
            )
        }
    }

    private fun recordTokens(call: String, kind: String, count: Long) {
        if (count <= 0) return
        Counter.builder(MetricNames.JEV_TOKENS)
            .tag("call", call)
            .tag("kind", kind)
            .register(meterRegistry)
            .increment(count.toDouble())
    }
}
