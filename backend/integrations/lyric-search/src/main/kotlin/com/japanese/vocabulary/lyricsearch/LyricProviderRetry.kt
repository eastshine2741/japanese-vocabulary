package com.japanese.vocabulary.lyricsearch

import com.japanese.vocabulary.common.retry.ExponentialBackoff
import com.japanese.vocabulary.common.retry.TransientHttpErrors
import com.japanese.vocabulary.common.retry.currentRetryDeadline
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.time.Duration

/**
 * Retries one provider HTTP request, not a whole search: a search sends up to six requests, and
 * retrying it as a unit resent the ones already answered into an lrclib that was answering 503
 * because it was overloaded.
 */
@Component
class LyricProviderRetry(
    @Value("\${lyric-search.retry.max-attempts:5}") maxAttempts: Int,
    @Value("\${lyric-search.retry.initial-backoff:2s}") initialBackoff: Duration,
) {
    private val logger = LoggerFactory.getLogger(LyricProviderRetry::class.java)
    private val backoff = ExponentialBackoff(maxAttempts, initialBackoff)

    suspend fun <T> call(provider: String, request: () -> T): T =
        backoff.retry(
            isTransient = TransientHttpErrors::isTransient,
            atLeast = TransientHttpErrors::retryAfter,
            onRetry = { attempt, e, wait ->
                logger.warn("{} request attempt {} failed, retrying in {}ms: {}", provider, attempt, wait.toMillis(), e.message)
            },
            deadline = currentRetryDeadline(),
            sleep = { delay(it.toMillis()) },
        ) {
            withContext(Dispatchers.IO) { request() }
        }
}
