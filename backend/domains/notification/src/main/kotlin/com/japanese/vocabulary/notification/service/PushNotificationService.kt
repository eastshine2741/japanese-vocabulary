package com.japanese.vocabulary.notification.service

import org.springframework.stereotype.Service
import com.google.firebase.messaging.AndroidConfig
import com.google.firebase.messaging.AndroidNotification
import com.google.firebase.messaging.ApnsConfig
import com.google.firebase.messaging.Aps
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingException
import com.google.firebase.messaging.Message
import com.google.firebase.messaging.MessagingErrorCode
import com.google.firebase.messaging.Notification
import com.japanese.vocabulary.notification.entity.NotificationLogEntity
import com.japanese.vocabulary.notification.repository.DeviceTokenRepository
import com.japanese.vocabulary.notification.repository.NotificationLogRepository
import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

/**
 * Pure FCM dispatch. Caller-agnostic: knows nothing about review reminders, candidates, users,
 * flashcards. Responsibilities:
 *   - Send a single visible push to one device token via firebase-admin
 *   - Persist accepted sends to `notification_logs`
 *   - Auto-delete tokens that FCM reports as UNREGISTERED (stale install)
 *
 * Invalid-token policy:
 *   - UNREGISTERED → delete token (FCM confirms it is dead)
 *   - INVALID_ARGUMENT → log, keep token (could be a sender-side format bug)
 *   - other errors    → log, keep token
 */
@ConditionalOnProperty(name = ["push.firebase.enabled"], havingValue = "true")
@Service
class PushNotificationService(
    private val firebaseMessaging: FirebaseMessaging,
    private val notificationLogRepository: NotificationLogRepository,
    private val deviceTokenRepository: DeviceTokenRepository,
) {
    private val logger = LoggerFactory.getLogger(PushNotificationService::class.java)

    /** Returns true if FCM accepted the message (does not guarantee end-user delivery). */
    fun send(
        userId: Long,
        token: String,
        title: String,
        body: String,
        data: Map<String, String> = emptyMap(),
    ): Boolean {
        val message = Message.builder()
            .setToken(token)
            .setNotification(
                Notification.builder()
                    .setTitle(title)
                    .setBody(body)
                    .build()
            )
            .setAndroidConfig(
                AndroidConfig.builder()
                    .setPriority(AndroidConfig.Priority.HIGH)
                    .setNotification(
                        AndroidNotification.builder()
                            .setChannelId(REVIEW_CHANNEL_ID)
                            .setPriority(AndroidNotification.Priority.HIGH)
                            .build()
                    )
                    .build()
            )
            .setApnsConfig(
                ApnsConfig.builder()
                    .putHeader("apns-push-type", "alert")
                    .putHeader("apns-priority", "10")
                    .setAps(
                        Aps.builder()
                            .setSound("default")
                            .build()
                    )
                    .build()
            )
            .putAllData(data)
            .build()

        return try {
            firebaseMessaging.send(message)
            recordLog(userId, Instant.now(), title, body)
            true
        } catch (e: FirebaseMessagingException) {
            handleFcmFailure(userId, token, e)
            false
        } catch (e: Exception) {
            logger.error("pushNotification unexpected failure userId={} token={}", userId, masked(token), e)
            false
        }
    }

    @Transactional
    fun recordLog(userId: Long, sentAt: Instant, title: String, body: String) {
        notificationLogRepository.save(
            NotificationLogEntity(
                userId = userId,
                sentAt = sentAt,
                title = title.take(MAX_TITLE_LEN),
                body = body.take(MAX_BODY_LEN),
            )
        )
    }

    private fun handleFcmFailure(userId: Long, token: String, e: FirebaseMessagingException) {
        when (e.messagingErrorCode) {
            MessagingErrorCode.UNREGISTERED -> {
                logger.info(
                    "pushNotification token UNREGISTERED — removing userId={} token={}",
                    userId, masked(token),
                )
                deleteInvalidToken(token)
            }
            MessagingErrorCode.INVALID_ARGUMENT -> {
                logger.error(
                    "pushNotification INVALID_ARGUMENT userId={} token={} — keeping token, manual review",
                    userId, masked(token), e,
                )
            }
            else -> {
                logger.error(
                    "pushNotification FCM failure code={} userId={} token={}",
                    e.messagingErrorCode, userId, masked(token), e,
                )
            }
        }
    }

    @Transactional
    fun deleteInvalidToken(token: String) {
        deviceTokenRepository.deleteByToken(token)
    }

    private fun masked(token: String): String =
        if (token.length <= 8) "***" else "${token.take(4)}…${token.takeLast(4)}"

    private companion object {
        const val REVIEW_CHANNEL_ID = "review-reminders"
        const val MAX_TITLE_LEN = 255
        const val MAX_BODY_LEN = 512
    }
}
