package com.japanese.vocabulary.common.retry

import java.time.Duration

/**
 * Exponential backoff with jitter and a cap: attempt 1 waits [initialDelay], attempt 2 double that,
 * and so on, each plus up to [jitter] of itself so parallel workers hitting the same outage do not
 * retry in lockstep, never longer than [maxDelay].
 *
 * The loop is [retry]. It is `inline` so the same policy serves a blocking caller (`Thread.sleep`)
 * and a coroutine (`delay`) — the caller hands in [sleep], and the lambda may suspend because it is
 * inlined into the caller's own body. What counts as worth retrying is the caller's too, since only
 * it knows its client: HTTP callers pass [TransientHttpErrors.isTransient].
 */
class ExponentialBackoff(
    val maxAttempts: Int,
    private val initialDelay: Duration,
    private val maxDelay: Duration = Duration.ofSeconds(60),
    private val jitter: Double = 0.25,
) {
    init {
        require(maxAttempts >= 1) { "maxAttempts must be at least 1, was $maxAttempts" }
        require(!initialDelay.isNegative) { "initialDelay must not be negative" }
    }

    /**
     * How long to wait after a failed [attempt] (1-based). [atLeast] is a floor the server asked
     * for — a `Retry-After` — and wins when it is longer; the cap still applies.
     */
    fun delayFor(attempt: Int, atLeast: Duration? = null): Duration {
        val exponential = initialDelay.multipliedBy(1L shl (attempt - 1).coerceIn(0, 10))
        val jittered = exponential.plusMillis((exponential.toMillis() * Math.random() * jitter).toLong())
        val chosen = if (atLeast != null && atLeast > jittered) atLeast else jittered
        return if (chosen > maxDelay) maxDelay else chosen
    }

    /**
     * Runs [block] until it returns, or throws its last error once [maxAttempts] are spent or the
     * error is not one [isTransient] accepts. [onRetry] sees every wait before it happens.
     */
    inline fun <T> retry(
        isTransient: (Throwable) -> Boolean,
        atLeast: (Throwable) -> Duration? = { null },
        onRetry: (attempt: Int, error: Throwable, delay: Duration) -> Unit = { _, _, _ -> },
        sleep: (Duration) -> Unit,
        block: (attempt: Int) -> T,
    ): T {
        var attempt = 1
        while (true) {
            try {
                return block(attempt)
            } catch (e: Throwable) {
                if (attempt >= maxAttempts || !isTransient(e)) throw e
                val delay = delayFor(attempt, atLeast(e))
                onRetry(attempt, e, delay)
                sleep(delay)
                attempt++
            }
        }
    }
}
