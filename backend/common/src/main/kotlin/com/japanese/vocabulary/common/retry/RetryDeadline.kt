package com.japanese.vocabulary.common.retry

import java.time.Instant
import kotlin.coroutines.AbstractCoroutineContextElement
import kotlin.coroutines.CoroutineContext
import kotlin.coroutines.coroutineContext

/**
 * The moment past which an in-process retry is no longer worth waiting for, carried in the coroutine
 * context so a client deep in the call stack can honour it without every layer passing it along.
 *
 * Song analysis sets it from its time budget; [ExponentialBackoff.retry] takes it as `deadline`.
 */
class RetryDeadline(val at: Instant) : AbstractCoroutineContextElement(Key) {
    companion object Key : CoroutineContext.Key<RetryDeadline>
}

suspend fun currentRetryDeadline(): Instant? = coroutineContext[RetryDeadline]?.at
