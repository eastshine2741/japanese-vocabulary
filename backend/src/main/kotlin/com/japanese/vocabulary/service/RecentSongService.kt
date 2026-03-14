package com.japanese.vocabulary.service

import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Service

@Service
class RecentSongService(
    private val redisTemplate: StringRedisTemplate
) {
    companion object {
        private const val MAX_RECENT = 16
    }

    private fun key(userId: Long) = "user:$userId:recent_songs"

    fun recordListen(userId: Long, songId: Long) {
        val key = key(userId)
        val score = System.currentTimeMillis().toDouble()
        redisTemplate.opsForZSet().add(key, songId.toString(), score)
        redisTemplate.opsForZSet().removeRange(key, 0, -(MAX_RECENT + 1).toLong())
    }

    fun getRecentSongIds(userId: Long): List<Long> {
        val key = key(userId)
        val ids = redisTemplate.opsForZSet().reverseRange(key, 0, (MAX_RECENT - 1).toLong())
        return ids?.mapNotNull { it.toLongOrNull() } ?: emptyList()
    }
}
