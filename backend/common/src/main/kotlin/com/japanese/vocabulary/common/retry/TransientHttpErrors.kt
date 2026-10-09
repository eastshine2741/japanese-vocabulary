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
 * timeouts — all surfaced as [ResourceAccessException]), a 5xx, or a 429. POSTs are not replayed by
 * Apache HttpClient on its own, so nothing else retries these.
 *
 * Everything else (4xx, malformed JSON, a response the caller rejects) would fail again the same way.
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
