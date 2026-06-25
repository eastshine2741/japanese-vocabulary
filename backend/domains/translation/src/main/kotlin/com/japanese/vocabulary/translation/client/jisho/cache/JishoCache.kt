package com.japanese.vocabulary.translation.client.jisho.cache

import org.springframework.stereotype.Component
import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.cache.RedisCache
import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryDto
import org.slf4j.LoggerFactory
import org.springframework.data.redis.core.StringRedisTemplate
import java.time.Duration

/**
 * Redis cache for jisho lookups (key `jisho:{word}`, TTL 30 days). Keys are namespaced here and
 * read/write errors are swallowed so a Redis hiccup degrades to a live fetch rather than failing
 * the pipeline. Callers pass the bare dictionary form; the prefix is applied internally.
 * Mirrors the `ArtistChannelCache` subclass pattern over [RedisCache].
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
        private const val KEY_PREFIX = "jisho:"
        private val TTL: Duration = Duration.ofDays(30)
    }
}
