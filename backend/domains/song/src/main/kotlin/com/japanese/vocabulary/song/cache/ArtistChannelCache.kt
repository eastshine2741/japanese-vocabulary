package com.japanese.vocabulary.song.cache

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.cache.Cache
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
) {
    private val logger = LoggerFactory.getLogger(ArtistChannelCache::class.java)

    private val cache: Cache<ArtistChannelCacheEntry> =
        RedisCache(redisTemplate, objectMapper, ArtistChannelCacheEntry::class.java)

    fun get(artistName: String): ArtistChannelCacheEntry? {
        val key = key(artistName)
        return try {
            cache.get(key)
        } catch (e: Exception) {
            logger.warn("Artist channel cache read failed (key='{}'): {}", key, e.javaClass.simpleName)
            null
        }
    }

    fun put(artistName: String, value: ArtistChannelCacheEntry) {
        val key = key(artistName)
        try {
            cache.put(key, value, TTL)
        } catch (e: Exception) {
            logger.warn("Artist channel cache write failed (key='{}'): {}", key, e.javaClass.simpleName)
        }
    }

    private fun key(artistName: String): String =
        KEY_PREFIX + Normalizer.normalize(artistName.trim(), Normalizer.Form.NFKC).lowercase()

    companion object {
        private const val KEY_PREFIX = "artist-channel:"
        private val TTL: Duration = Duration.ofDays(90)
    }
}
