package com.japanese.vocabulary.song.cache

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.cache.RedisCache
import com.japanese.vocabulary.observability.MetricNames
import com.japanese.vocabulary.song.dto.SongSearchResponse
import io.micrometer.core.instrument.Counter
import io.micrometer.core.instrument.MeterRegistry
import org.slf4j.LoggerFactory
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import java.time.Duration

@Component
class SongSearchCache(
    redisTemplate: StringRedisTemplate,
    objectMapper: ObjectMapper,
    meterRegistry: MeterRegistry,
) : RedisCache<SongSearchResponse>(
    redisTemplate,
    objectMapper,
    SongSearchResponse::class.java,
) {
    private val logger = LoggerFactory.getLogger(SongSearchCache::class.java)

    private val hit = counter(meterRegistry, "hit")
    private val miss = counter(meterRegistry, "miss")
    private val readError = counter(meterRegistry, "read_error")
    private val writeError = counter(meterRegistry, "write_error")

    override fun get(key: String): SongSearchResponse? {
        val redisKey = redisKeyFor(key)
        return try {
            val value = super.get(redisKey)
            if (value != null) hit.increment() else miss.increment()
            value
        } catch (e: Exception) {
            readError.increment()
            logger.warn("Search cache read failed (key='{}'): {}", redisKey, e.javaClass.simpleName)
            null
        }
    }

    override fun put(key: String, value: SongSearchResponse, ttl: Duration) {
        val redisKey = redisKeyFor(key)
        try {
            super.put(redisKey, value, ttl)
        } catch (e: Exception) {
            writeError.increment()
            logger.warn("Search cache write failed (key='{}'): {}", redisKey, e.javaClass.simpleName)
        }
    }

    fun put(query: String, value: SongSearchResponse) {
        put(query, value, TTL)
    }

    private fun counter(registry: MeterRegistry, result: String): Counter =
        Counter.builder(MetricNames.SONG_SEARCH_CACHE)
            .tag("result", result)
            .register(registry)

    private fun redisKeyFor(query: String): String = KEY_PREFIX + query

    companion object {
        private const val KEY_PREFIX = "song-search:"
        private val TTL: Duration = Duration.ofHours(1)
    }
}
