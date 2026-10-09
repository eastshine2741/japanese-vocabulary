package com.japanese.vocabulary.artist.cache

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.cache.RedisCache
import com.japanese.vocabulary.songsearch.dto.SongSearchResponse
import org.slf4j.LoggerFactory
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import java.time.Duration

/** 인기곡은 하루 단위로 거의 안 바뀌고, 모든 유저가 한 개발자 토큰을 나눠 쓴다. Redis 가 죽으면 캐시 없이 간다. */
@Component
class ArtistTopSongsCache(
    redisTemplate: StringRedisTemplate,
    objectMapper: ObjectMapper,
) : RedisCache<SongSearchResponse>(redisTemplate, objectMapper, SongSearchResponse::class.java) {
    private val logger = LoggerFactory.getLogger(ArtistTopSongsCache::class.java)

    override fun get(key: String): SongSearchResponse? =
        try {
            super.get(KEY_PREFIX + key)
        } catch (e: Exception) {
            logger.warn("Artist top songs cache read failed (key='{}'): {}", key, e.javaClass.simpleName)
            null
        }

    fun put(appleMusicId: String, value: SongSearchResponse) {
        try {
            super.put(KEY_PREFIX + appleMusicId, value, TTL)
        } catch (e: Exception) {
            logger.warn("Artist top songs cache write failed (key='{}'): {}", appleMusicId, e.javaClass.simpleName)
        }
    }

    companion object {
        private const val KEY_PREFIX = "artist-top-songs:"
        private val TTL: Duration = Duration.ofDays(1)
    }
}
