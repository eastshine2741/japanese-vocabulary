package com.japanese.vocabulary.cache

import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.data.redis.core.StringRedisTemplate
import java.time.Duration

/**
 * JSON-over-Redis cache. Serializes values to a string with the supplied
 * [ObjectMapper]; the caller owns the type via [valueType]. Errors from the
 * underlying [StringRedisTemplate] propagate so the caller can decide on
 * fallback behavior and metric tagging.
 */
open class RedisCache<V>(
    private val template: StringRedisTemplate,
    private val objectMapper: ObjectMapper,
    private val valueType: Class<V>,
) : Cache<V> {
    override fun get(key: String): V? {
        val raw = template.opsForValue().get(key) ?: return null
        return objectMapper.readValue(raw, valueType)
    }

    override fun put(key: String, value: V, ttl: Duration) {
        template.opsForValue().set(key, objectMapper.writeValueAsString(value), ttl)
    }
}
