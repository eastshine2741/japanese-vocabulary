package com.japanese.vocabulary.translation.client.jisho.cache

import org.springframework.stereotype.Component
import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.cache.RedisCache
import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryDto
import org.slf4j.LoggerFactory
import org.springframework.data.redis.core.StringRedisTemplate
import java.time.Duration

/**
 * Redis cache for jisho lookups (key `jisho:v5:{word}`, TTL 30 days). Read/write errors are swallowed
 * so a Redis hiccup degrades to a live fetch. Callers pass the bare dictionary form.
 */
@Component
class JishoCache(
    redisTemplate: StringRedisTemplate,
    objectMapper: ObjectMapper,
) : RedisCache<JishoEntryDto>(
    redisTemplate,
    objectMapper,
    JishoEntryDto::class.java,
) {
    private val logger = LoggerFactory.getLogger(JishoCache::class.java)

    override fun get(key: String): JishoEntryDto? {
        val redisKey = KEY_PREFIX + key
        return try {
            super.get(redisKey)
        } catch (e: Exception) {
            logger.warn("jisho cache read failed (word='{}'): {}", key, e.javaClass.simpleName)
            null
        }
    }

    override fun put(key: String, value: JishoEntryDto, ttl: Duration) {
        val redisKey = KEY_PREFIX + key
        try {
            super.put(redisKey, value, ttl)
        } catch (e: Exception) {
            logger.warn("jisho cache write failed (word='{}'): {}", key, e.javaClass.simpleName)
        }
    }

    /** Cache with the default 30-day TTL. */
    fun put(word: String, value: JishoEntryDto) = put(word, value, TTL)

    companion object {
        // Bump on payload shape change: an old payload deserializes into an empty `entries` list, silently losing every meaning.
        private const val KEY_PREFIX = "jisho:v5:"
        private val TTL: Duration = Duration.ofDays(30)
    }
}
