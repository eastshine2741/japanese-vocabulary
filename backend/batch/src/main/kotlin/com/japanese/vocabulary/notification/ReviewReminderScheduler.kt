package com.japanese.vocabulary.notification

import com.japanese.vocabulary.flashcard.repository.FlashcardRepository
import com.japanese.vocabulary.notification.repository.DeviceTokenRepository
import com.japanese.vocabulary.notification.service.PushNotificationService
import com.japanese.vocabulary.user.repository.UserSettingsRepository
import com.japanese.vocabulary.word.repository.WordRepository
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.Instant

/**
 * Picks review-reminder recipients at 09:00 / 18:00 KST and dispatches one push per user via
 * [PushNotificationService]. All "who / when / what message" decisions live here; the notification
 * module only sees primitives (token, title, body, data).
 *
 * Candidate filter:
 *  - Has a registered device token
 *  - notificationsEnabled (missing settings row → treated as enabled)
 *  - At least one previously-reviewed flashcard due within the last [LOOKBACK_WINDOW]
 *  - The oldest such due card determines the deep-link target
 */
@Component
class ReviewReminderScheduler(
    private val pushNotificationService: PushNotificationService,
    private val flashcardRepository: FlashcardRepository,
    private val deviceTokenRepository: DeviceTokenRepository,
    private val userSettingsRepository: UserSettingsRepository,
    private val wordRepository: WordRepository,
) {
    private val logger = LoggerFactory.getLogger(ReviewReminderScheduler::class.java)

    data class Result(val sent: Int, val failed: Int)

    @Scheduled(cron = "0 0 9 * * *", zone = "Asia/Seoul")
    fun runMorning() = runReminders("morning")

    @Scheduled(cron = "0 0 18 * * *", zone = "Asia/Seoul")
    fun runEvening() = runReminders("evening")

    fun dispatch(now: Instant = Instant.now()): Result {
        val candidates = findCandidates(now)
        var sent = 0
        var failed = 0
        for (c in candidates) {
            val title = "${c.wordSurface}, 이 단어 기억나시나요?"
            val body = "잊어버리기 전에 잠깐 들러보세요."
            val data = mapOf(
                "type" to "review_reminder",
                "flashcardId" to c.flashcardId.toString(),
            )
            if (pushNotificationService.send(c.userId, c.token, title, body, data)) sent++ else failed++
        }
        logger.info(
            "pushNotification dispatch now={} candidates={} sent={} failed={}",
            now, candidates.size, sent, failed,
        )
        return Result(sent, failed)
    }

    private fun runReminders(label: String) {
        try {
            val result = dispatch()
            logger.info("pushNotification {} run result={}", label, result)
        } catch (e: Exception) {
            logger.error("pushNotification {} run failed", label, e)
        }
    }

    @Transactional(readOnly = true)
    fun findCandidates(now: Instant): List<ReviewReminderCandidate> {
        val since = now.minus(LOOKBACK_WINDOW)

        val tokensByUserId = deviceTokenRepository.findAll()
            .groupBy { it.userId }
            .mapValues { (_, tokens) -> tokens.first() }

        if (tokensByUserId.isEmpty()) return emptyList()

        val settingsByUserId = userSettingsRepository.findAll().associateBy { it.userId }

        val out = mutableListOf<ReviewReminderCandidate>()
        for ((userId, token) in tokensByUserId) {
            val settings = settingsByUserId[userId]
            if (settings != null && !settings.settings.notificationsEnabled) continue

            val dueCards = flashcardRepository.findByUserIdAndDueBetweenAndLastReviewIsNotNull(
                userId = userId,
                since = since,
                now = now,
            )
            val oldest = dueCards.minByOrNull { it.due } ?: continue
            val word = wordRepository.findById(oldest.wordId).orElse(null) ?: continue

            out += ReviewReminderCandidate(
                userId = userId,
                token = token.token,
                flashcardId = oldest.id!!,
                wordSurface = word.japaneseText,
            )
        }
        return out
    }

    private companion object {
        val LOOKBACK_WINDOW: Duration = Duration.ofDays(7)
    }
}

data class ReviewReminderCandidate(
    val userId: Long,
    val token: String,
    val flashcardId: Long,
    val wordSurface: String,
)
