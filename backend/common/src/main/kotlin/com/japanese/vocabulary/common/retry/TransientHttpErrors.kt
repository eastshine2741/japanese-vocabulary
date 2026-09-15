package com.japanese.vocabulary.common.retry

import org.springframework.http.HttpStatus
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.HttpServerErrorException
import org.springframework.web.client.ResourceAccessException
import org.springframework.web.client.RestClientResponseException
import java.time.Duration

/**
 * Which `RestClient` failures are worth another attempt.
 *
 * Only transport-level trouble qualifies: a dropped connection (`NoHttpResponseException`, socket
 * timeouts — all surfaced as [ResourceAccessException]), a 5xx, or a 429. A prod work once died on
 * a single 75-second `generativelanguage.googleapis.com:443 failed to respond` that the same input
 * sailed through four minutes later; nothing in the stack retried it because the request is a POST
 * and Apache HttpClient only replays idempotent methods on its own. jisho did the same with a
 * ninety-second run of 502s.
 *
 * Everything else — 4xx, malformed JSON, a response the caller itself rejects — reflects the request
 * or the answer and would fail again the same way.
 */
object TransientHttpErrors {
    fun isTransient(error: Throwable): Boolean = when (error) {
        is ResourceAccessException -> true
        is HttpServerErrorException -> true
        is HttpClientErrorException -> error.statusCode == HttpStatus.TOO_MANY_REQUESTS
        else -> false
    }

    /** The server's own `Retry-After`, in seconds form only, or null. */
    fun retryAfter(error: Throwable): Duration? {
        val header = (error as? RestClientResponseException)?.responseHeaders?.getFirst("Retry-After")
            ?: return null
        val seconds = header.trim().toLongOrNull() ?: return null
        return Duration.ofSeconds(seconds)
    }
}
