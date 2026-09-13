package com.japanese.vocabulary.notification.service

import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.data.redis.core.script.DefaultRedisScript
import org.springframework.stereotype.Service
import java.time.Duration

/** One-shot subscriptions, scoped to one analysis attempt rather than the lifetime of a song. */
@Service
class AnalysisNotificationSubscriptions(private val redis: StringRedisTemplate) {
    fun subscribe(workId: Long, userId: Long) {
        redis.execute(SUBSCRIBE, listOf(key(workId)), userId.toString(), TTL.seconds.toString())
    }

    fun unsubscribe(workId: Long, userId: Long) {
        redis.opsForSet().remove(key(workId), userId.toString())
    }

    /** Reading and deleting must be atomic, including when duplicate completion events arrive. */
    fun consume(workId: Long): List<Long> =
        redis.execute(CONSUME, listOf(key(workId))).orEmpty().map { it.toString().toLong() }

    private fun key(workId: Long) = "analysis:notifications:$workId"

    private companion object {
        val TTL: Duration = Duration.ofHours(24)
        val SUBSCRIBE = DefaultRedisScript(
            """
                redis.call('SADD', KEYS[1], ARGV[1])
                redis.call('EXPIRE', KEYS[1], ARGV[2])
                return 1
            """.trimIndent(),
            Long::class.java,
        )
        val CONSUME = DefaultRedisScript(
            """
                local subscribers = redis.call('SMEMBERS', KEYS[1])
                redis.call('DEL', KEYS[1])
                return subscribers
            """.trimIndent(),
            List::class.java,
        )
    }
}
