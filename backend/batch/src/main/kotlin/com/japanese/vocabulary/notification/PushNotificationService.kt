package com.japanese.vocabulary.notification

import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingException
import com.google.firebase.messaging.Message
import com.google.firebase.messaging.MessagingErrorCode
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.time.Instant

/**
 * Orchestrates one push-notification run. NOT transactional — FCM `send()` is external I/O so it
 * must never sit inside an open DB transaction. DB writes happen via
 * [PushNotificationDataAccess]'s `REQUIRES_NEW` methods which keep each commit short.
 *
 * Logging policy: only successful FCM sends are persisted to `notification_logs`. Failures are
 * surfaced through `logger.error` (or `logger.info` for the benign UNREGISTERED case) — we cannot
 * verify end-user delivery anyway, so the row records "FCM accepted the message", nothing more.
 *
 * Invalid-token policy (AC-BATCH-7 step 5):
 *  - `UNREGISTERED` → auto-delete the device token (FCM confirms unregister)
 *  - `INVALID_ARGUMENT` → log only, do NOT delete (could be a message-format bug; we refuse to
 *    nuke a healthy token over a sender mistake)
 *  - Anything else → log only, no deletion
 */
@Service
class PushNotificationService(
    private val dataAccess: PushNotificationDataAccess,
    private val firebaseMessaging: FirebaseMessaging,
) {
    private val logger = LoggerFactory.getLogger(PushNotificationService::class.java)

    data class Result(val sent: Int, val failed: Int)

    fun sendReviewReminders(now: Instant): Result {
        val candidates = dataAccess.findCandidates(now)
        var sent = 0
        var failed = 0
        for (candidate in candidates) {
            if (sendOne(candidate)) sent++ else failed++
        }
        logger.info(
            "pushNotification run now={} candidates={} sent={} failed={}",
            now, candidates.size, sent, failed,
        )
        return Result(sent = sent, failed = failed)
    }

    private fun sendOne(candidate: NotificationCandidate): Boolean {
        val title = "${candidate.wordSurface}, 이 단어 기억나시나요?"
        val body = "잊어버리기 전에 잠깐 들러보세요."
        val message = Message.builder()
            .setToken(candidate.token)
            .setNotification(
                com.google.firebase.messaging.Notification.builder()
                    .setTitle(title)
                    .setBody(body)
                    .build()
            )
            .putData("type", "review_reminder")
            .putData("flashcardId", candidate.flashcardId.toString())
            .build()

        return try {
            firebaseMessaging.send(message)
            dataAccess.recordLog(
                userId = candidate.userId,
                sentAt = Instant.now(),
                title = title,
                body = body,
            )
            true
        } catch (e: FirebaseMessagingException) {
            handleFcmFailure(candidate, e)
            false
        } catch (e: Exception) {
            logger.error(
                "pushNotification unexpected failure userId={} token={}",
                candidate.userId, masked(candidate.token), e,
            )
            false
        }
    }

    private fun handleFcmFailure(
        candidate: NotificationCandidate,
        e: FirebaseMessagingException,
    ) {
        when (e.messagingErrorCode) {
            MessagingErrorCode.UNREGISTERED -> {
                logger.info(
                    "pushNotification token UNREGISTERED — removing userId={} token={}",
                    candidate.userId, masked(candidate.token),
                )
                dataAccess.deleteInvalidToken(candidate.token)
            }
            MessagingErrorCode.INVALID_ARGUMENT -> {
                // Do NOT delete: format bug should not destroy a legitimate token.
                logger.error(
                    "pushNotification INVALID_ARGUMENT userId={} token={} — keeping token, manual review",
                    candidate.userId, masked(candidate.token), e,
                )
            }
            else -> {
                logger.error(
                    "pushNotification FCM failure code={} userId={} token={}",
                    e.messagingErrorCode, candidate.userId, masked(candidate.token), e,
                )
            }
        }
    }

    private fun masked(token: String): String =
        if (token.length <= 8) "***" else "${token.take(4)}…${token.takeLast(4)}"
}
