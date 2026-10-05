package com.japanese.vocabulary.karaoke.batch

import com.japanese.vocabulary.karaoke.dto.KaraokeSongDto
import com.japanese.vocabulary.karaoke.service.KaraokeSongService
import com.japanese.vocabulary.karaoke.service.KaraokeTitleCleaner
import com.japanese.vocabulary.notification.repository.DeviceTokenRepository
import com.japanese.vocabulary.notification.service.PushNotificationService
import com.japanese.vocabulary.user.repository.UserRepository
import com.japanese.vocabulary.user.repository.UserSettingsRepository
import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

/**
 * 아직 알리지 않은 원장 행을 구독자에게 한 건으로 알린다. 분석 결과는 기다리지 않는다.
 * 노래방별 행이라 TJ 에 오른 곡이 다른 날 금영에도 오르면 그날 다시 알린다.
 */
@Component
@ConditionalOnProperty(name = ["push.firebase.enabled"], havingValue = "true")
class KaraokeNewSongNotifier(
    private val karaokeSongService: KaraokeSongService,
    private val pushNotificationService: PushNotificationService,
    private val deviceTokenRepository: DeviceTokenRepository,
    private val userRepository: UserRepository,
    private val userSettingsRepository: UserSettingsRepository,
) {
    private val logger = LoggerFactory.getLogger(KaraokeNewSongNotifier::class.java)

    data class Result(val songs: Int, val sent: Int, val failed: Int)

    data class Message(val title: String, val body: String)

    data class Target(val userId: Long, val token: String)

    /** [send] 가 false 면 보내지 않고 알린 것으로만 표시한다(첫 배포 백필용). */
    fun notifyPending(now: Instant, send: Boolean): Result {
        val rows = karaokeSongService.findUnnotified()
        if (rows.isEmpty()) return Result(0, 0, 0)
        var sent = 0
        var failed = 0
        val message = compose(rows)
        if (send) {
            for (target in findTargets()) {
                val data = mapOf("type" to PUSH_TYPE, "title" to message.title, "body" to message.body)
                if (pushNotificationService.send(target.userId, target.token, message.title, message.body, data)) sent++ else failed++
            }
        }
        karaokeSongService.markNotified(rows.map { it.id }, now)
        val result = Result(rows.size, sent, failed)
        logger.info("karaokeNotify send={} result={}", send, result)
        return result
    }

    @Transactional(readOnly = true)
    fun findTargets(): List<Target> {
        val subscriberIds = userSettingsRepository.findAll()
            .filter { it.settings.notificationsEnabled && it.settings.karaokeNewSongAlerts }
            .map { it.userId }
        if (subscriberIds.isEmpty()) return emptyList()
        val activeIds = userRepository.findAllById(subscriberIds).filter { it.deletedAt == null }.mapNotNull { it.id }
        return activeIds.flatMap { userId ->
            deviceTokenRepository.findAllByUserId(userId).map { Target(userId, it.token) }
        }
    }

    companion object {
        const val PUSH_TYPE = "karaoke_new_songs"

        /** 같은 날 두 노래방에 함께 오른 곡은 한 곡으로 센다. */
        fun compose(rows: List<KaraokeSongDto>): Message {
            val songs = rows.distinctBy { it.listedOn to KaraokeTitleCleaner.mergeKey(it.title, it.artist) }
            val first = songs.first()
            val rest = songs.size - 1
            val body = "${first.title} - ${first.artist}" + if (rest > 0) " 외 ${rest}곡" else ""
            return Message(title = "노래방에 새 일본곡 ${songs.size}곡", body = body)
        }
    }
}
