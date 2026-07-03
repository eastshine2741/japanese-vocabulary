package com.japanese.vocabulary.song.service

import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Service

/**
 * Per-user recent search history backed by a Redis list (most recent first).
 * Re-searching an existing term moves it to the top (dedup, single entry).
 * The list is capped at [MAX_HISTORY]; the oldest entries fall off. No TTL.
 */
@Service
class SearchHistoryService(
    private val redisTemplate: StringRedisTemplate,
) {
    companion object {
        private const val MAX_HISTORY = 20L
    }

    private fun key(userId: Long) = "search:history:$userId"

    fun record(userId: Long, term: String) {
        val trimmed = term.trim()
        if (trimmed.isEmpty()) return
        val key = key(userId)
        val ops = redisTemplate.opsForList()
        ops.remove(key, 0, trimmed)
        ops.leftPush(key, trimmed)
        ops.trim(key, 0, MAX_HISTORY - 1)
    }

    fun getHistory(userId: Long): List<String> =
        redisTemplate.opsForList().range(key(userId), 0, MAX_HISTORY - 1) ?: emptyList()

    fun delete(userId: Long, term: String) {
        redisTemplate.opsForList().remove(key(userId), 0, term.trim())
    }
}
