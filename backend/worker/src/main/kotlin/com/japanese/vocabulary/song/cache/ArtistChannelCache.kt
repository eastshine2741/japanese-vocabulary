package com.japanese.vocabulary.song.cache

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.cache.RedisCache
import org.slf4j.LoggerFactory
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import java.time.Duration
import java.text.Normalizer

data class ArtistChannelCacheEntry(
    val artistName: String,
    val channelId: String,
    val uploadsPlaylistId: String,
    val channelTitle: String,
)

@Component
class ArtistChannelCache(
    redisTemplate: StringRedisTemplate,
    objectMapper: ObjectMapper,
) : RedisCache<ArtistChannelCacheEntry>(
    redisTemplate,
    objectMapper,
    ArtistChannelCacheEntry::class.java,
) {
    private val logger = LoggerFactory.getLogger(ArtistChannelCache::class.java)

    override fun get(key: String): ArtistChannelCacheEntry? {
        val redisKey = redisKeyFor(key)
        return try {
            super.get(redisKey)
        } catch (e: Exception) {
            logger.warn("Artist channel cache read failed (key='{}'): {}", redisKey, e.javaClass.simpleName)
            null
        }
    }

    override fun put(key: String, value: ArtistChannelCacheEntry, ttl: Duration) {
        val redisKey = redisKeyFor(key)
        try {
            super.put(redisKey, value, ttl)
        } catch (e: Exception) {
            logger.warn("Artist channel cache write failed (key='{}'): {}", redisKey, e.javaClass.simpleName)
        }
    }

    fun put(artistName: String, value: ArtistChannelCacheEntry) {
        put(artistName, value, TTL)
    }

    private fun redisKeyFor(artistName: String): String =
        KEY_PREFIX + Normalizer.normalize(artistName.trim(), Normalizer.Form.NFKC).lowercase()

    companion object {
        private const val KEY_PREFIX = "artist-channel:"
        private val TTL: Duration = Duration.ofDays(90)
    }
}
