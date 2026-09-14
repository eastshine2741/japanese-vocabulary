package com.japanese.vocabulary.translation.client.gemini

import org.springframework.http.HttpStatus
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.HttpServerErrorException
import org.springframework.web.client.ResourceAccessException
import org.springframework.web.client.RestClientResponseException
import java.time.Duration
import kotlin.math.min

/**
 * Decides which Gemini failures are worth another attempt and how long to wait before it.
 *
 * Only transport-level trouble qualifies: a dropped connection (`NoHttpResponseException`, socket
 * timeouts — all surfaced as [ResourceAccessException]), a 5xx, or a 429. A prod work once died on
 * a single 75-second `generativelanguage.googleapis.com:443 failed to respond` that the same input
 * sailed through four minutes later; nothing in the stack retried it because the request is a POST
 * and Apache HttpClient only replays idempotent methods on its own.
 *
 * Everything else — 4xx, malformed JSON, [GeminiIncompleteResponseException] — reflects the request
 * or the model's answer and would fail again the same way.
 */
internal object GeminiRetryPolicy {
    /** Upper bound so a hostile `Retry-After` cannot park a worker for minutes. */
    private val MAX_BACKOFF: Duration = Duration.ofSeconds(60)

    fun isTransient(error: Throwable): Boolean = when (error) {
        is ResourceAccessException -> true
        is HttpServerErrorException -> true
        is HttpClientErrorException -> error.statusCode == HttpStatus.TOO_MANY_REQUESTS
        else -> false
    }

    /**
     * Exponential backoff from [initialBackoff] — `attempt` 1 waits the base, 2 waits double, and so
     * on — with up to 25% jitter so parallel workers hitting the same outage don't retry in lockstep.
     * A `Retry-After` on a 429/503 wins when it asks for longer.
     */
    fun backoff(attempt: Int, error: Throwable, initialBackoff: Duration): Duration {
        val exponential = initialBackoff.multipliedBy(1L shl (attempt - 1).coerceIn(0, 10))
        val jittered = exponential.plusMillis((exponential.toMillis() * Math.random() * 0.25).toLong())
        val retryAfter = retryAfter(error)
        val chosen = if (retryAfter != null && retryAfter > jittered) retryAfter else jittered
        return min(chosen.toMillis(), MAX_BACKOFF.toMillis()).let(Duration::ofMillis)
    }

    private fun retryAfter(error: Throwable): Duration? {
        val header = (error as? RestClientResponseException)?.responseHeaders?.getFirst("Retry-After")
            ?: return null
        val seconds = header.trim().toLongOrNull() ?: return null
        return Duration.ofSeconds(seconds)
    }
}
