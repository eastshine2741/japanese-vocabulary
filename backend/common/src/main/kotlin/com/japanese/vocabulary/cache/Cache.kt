package com.japanese.vocabulary.cache

import java.time.Duration

/**
 * Minimal cache contract. Implementations decide the backing store.
 * `get` and `put` may throw on backend failure — callers are expected to
 * handle (or surface) errors as appropriate for their use case.
 */
interface Cache<V> {
    fun get(key: String): V?
    fun put(key: String, value: V, ttl: Duration)
}
