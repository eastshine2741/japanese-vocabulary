package com.japanese.vocabulary.common.retry

import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.HttpServerErrorException
import org.springframework.web.client.ResourceAccessException
import java.time.Duration

class ExponentialBackoffTest {

    @Test
    fun `delay doubles per attempt and is capped`() {
        val backoff = ExponentialBackoff(maxAttempts = 3, initialDelay = Duration.ofSeconds(2))

        assertThat(backoff.delayFor(1)).isBetween(Duration.ofSeconds(2), Duration.ofMillis(2500))
        assertThat(backoff.delayFor(2)).isBetween(Duration.ofSeconds(4), Duration.ofSeconds(5))
        assertThat(backoff.delayFor(20)).isEqualTo(Duration.ofSeconds(60))
    }

    @Test
    fun `a longer floor wins, the cap still applies`() {
        val backoff = ExponentialBackoff(maxAttempts = 3, initialDelay = Duration.ofSeconds(2), maxDelay = Duration.ofSeconds(30))

        assertThat(backoff.delayFor(1, atLeast = Duration.ofSeconds(10))).isEqualTo(Duration.ofSeconds(10))
        assertThat(backoff.delayFor(1, atLeast = Duration.ofSeconds(1))).isBetween(Duration.ofSeconds(2), Duration.ofMillis(2500))
        assertThat(backoff.delayFor(1, atLeast = Duration.ofMinutes(5))).isEqualTo(Duration.ofSeconds(30))
    }

    @Test
    fun `retries transient failures up to maxAttempts and returns the later success`() {
        val backoff = ExponentialBackoff(maxAttempts = 3, initialDelay = Duration.ZERO)
        val slept = mutableListOf<Duration>()
        var calls = 0

        val result = backoff.retry(
            isTransient = { true },
            sleep = { slept += it },
        ) { attempt ->
            calls++
            if (attempt < 3) throw IllegalStateException("try again") else "ok"
        }

        assertThat(result).isEqualTo("ok")
        assertThat(calls).isEqualTo(3)
        assertThat(slept).hasSize(2)
    }

    @Test
    fun `throws the last error once attempts are spent`() {
        val backoff = ExponentialBackoff(maxAttempts = 2, initialDelay = Duration.ZERO)
        var calls = 0

        assertThatThrownBy {
            backoff.retry(isTransient = { true }, sleep = {}) { calls++; throw IllegalStateException("still down") }
        }.hasMessage("still down")
        assertThat(calls).isEqualTo(2)
    }

    @Test
    fun `does not retry what the caller calls final`() {
        val backoff = ExponentialBackoff(maxAttempts = 5, initialDelay = Duration.ZERO)
        var calls = 0

        assertThatThrownBy {
            backoff.retry(isTransient = { false }, sleep = {}) { calls++; throw IllegalArgumentException("bad request") }
        }.isInstanceOf(IllegalArgumentException::class.java)
        assertThat(calls).isEqualTo(1)
    }

    @Test
    fun `transient means transport trouble, 5xx, or 429`() {
        assertThat(TransientHttpErrors.isTransient(ResourceAccessException("io"))).isTrue()
        assertThat(TransientHttpErrors.isTransient(HttpServerErrorException(HttpStatus.INTERNAL_SERVER_ERROR))).isTrue()
        assertThat(TransientHttpErrors.isTransient(HttpClientErrorException(HttpStatus.TOO_MANY_REQUESTS))).isTrue()
        assertThat(TransientHttpErrors.isTransient(HttpClientErrorException(HttpStatus.BAD_REQUEST))).isFalse()
        assertThat(TransientHttpErrors.isTransient(IllegalStateException("parse"))).isFalse()
    }

    @Test
    fun `Retry-After in seconds becomes the floor`() {
        val headers = HttpHeaders().apply { set("Retry-After", "7") }
        val error = HttpClientErrorException.create(HttpStatus.TOO_MANY_REQUESTS, "", headers, ByteArray(0), null)

        assertThat(TransientHttpErrors.retryAfter(error)).isEqualTo(Duration.ofSeconds(7))
        assertThat(TransientHttpErrors.retryAfter(ResourceAccessException("io"))).isNull()
    }
}
