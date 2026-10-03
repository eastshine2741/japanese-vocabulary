package com.japanese.vocabulary.notification

import com.japanese.vocabulary.notification.repository.DeviceTokenRepository
import com.japanese.vocabulary.notification.service.AnalysisNotificationSubscriptions
import com.japanese.vocabulary.notification.service.PushNotificationService
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.songanalysis.event.SongAnalysisCompletedEvent
import com.japanese.vocabulary.user.repository.UserRepository
import com.japanese.vocabulary.user.repository.UserSettingsRepository
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.ObjectProvider
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional

@Service
class AnalysisNotificationDispatcher(
    private val subscriptions: AnalysisNotificationSubscriptions,
    private val userRepository: UserRepository,
    private val settingsRepository: UserSettingsRepository,
    private val tokenRepository: DeviceTokenRepository,
    private val songRepository: SongRepository,
    private val pushProvider: ObjectProvider<PushNotificationService>,
) {
    private val logger = LoggerFactory.getLogger(javaClass)

    // AFTER_COMMIT still has the publisher's resources bound. Notification log writes and
    // invalid-token cleanup need their own transaction; any failure is caught by the listener.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun dispatch(event: SongAnalysisCompletedEvent) {
        val userIds = subscriptions.consume(event.workId)
        if (userIds.isEmpty()) return
        val push = pushProvider.ifAvailable ?: return
        val song = songRepository.findById(event.songId).orElse(null) ?: return
        val data = mapOf(
            "type" to "song_analysis_completed",
            "songId" to event.songId.toString(),
            "workId" to event.workId.toString(),
        )
        for (userId in userIds) {
            try {
                if (userRepository.findByIdAndDeletedAtIsNull(userId) == null) continue
                if (settingsRepository.findByUserId(userId)?.settings?.notificationsEnabled == false) continue
                for (device in tokenRepository.findAllByUserId(userId)) {
                    push.send(userId, device.token, "곡 분석이 완료됐어요", "${song.title}의 가사와 단어를 확인해 보세요.", data)
                }
            } catch (e: Exception) {
                logger.warn("Analysis notification failed workId={} userId={}", event.workId, userId, e)
            }
        }
    }
}
