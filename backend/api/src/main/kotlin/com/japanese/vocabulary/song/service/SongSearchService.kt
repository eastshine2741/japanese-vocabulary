package com.japanese.vocabulary.song.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.song.client.itunes.ItunesClient
import com.japanese.vocabulary.song.dto.SongSearchResponse
import org.slf4j.LoggerFactory
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Service
import java.text.Normalizer
import java.time.Duration

/**
 * Wraps [ItunesClient] with a Redis-backed search-result cache.
 *
 * iTunes Search API enforces ~20 calls/min/IP. This cache absorbs the burst of
 * duplicate queries that arrive within an hour — typically the same popular
 * songs queried by many users in a short window. On Redis failure we fall
 * through to a direct iTunes call so the search endpoint never goes dark.
 */
@Service
class SongSearchService(
    private val itunesClient: ItunesClient,
    private val redisTemplate: StringRedisTemplate,
    private val objectMapper: ObjectMapper
) {
    private val logger = LoggerFactory.getLogger(SongSearchService::class.java)

    fun search(rawQuery: String): SongSearchResponse {
        val normalized = normalize(rawQuery)
        if (normalized.isBlank()) return SongSearchResponse(emptyList())

        val key = CACHE_KEY_PREFIX + normalized
        try {
            redisTemplate.opsForValue().get(key)?.let { cached ->
                return objectMapper.readValue(cached, SongSearchResponse::class.java)
            }
        } catch (e: Exception) {
            logger.warn("Search cache read failed (key='{}'): {}", key, e.javaClass.simpleName)
        }

        val result = itunesClient.search(rawQuery)
        try {
            redisTemplate.opsForValue().set(key, objectMapper.writeValueAsString(result), CACHE_TTL)
        } catch (e: Exception) {
            logger.warn("Search cache write failed (key='{}'): {}", key, e.javaClass.simpleName)
        }
        return result
    }

    /**
     * Cache-key normalization. Only safe transforms — these unify whitespace and
     * unicode width but never alter the user's intended query semantically.
     * Kana/kanji are left untouched: katakana↔hiragana conversion yields a
     * different iTunes result and would surface as a wrong-search UX bug.
     */
    private fun normalize(q: String): String =
        Normalizer.normalize(q.trim(), Normalizer.Form.NFKC)
            .replace(WHITESPACE_RE, " ")
            .lowercase()

    companion object {
        private const val CACHE_KEY_PREFIX = "song-search:"
        private val CACHE_TTL: Duration = Duration.ofHours(1)
        private val WHITESPACE_RE = Regex("\\s+")
    }
}
