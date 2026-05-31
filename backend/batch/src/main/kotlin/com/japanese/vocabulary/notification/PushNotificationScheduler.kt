package com.japanese.vocabulary.notification

import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.time.Instant

/**
 * Drives [PushNotificationService.sendReviewReminders] at 09:00 / 18:00 KST. Mirrors the
 * `FreezeConsumeScheduler` pattern. Each tick passes `Instant.now()` so the SQL filters on cards
 * actually due at the moment of dispatch.
 */
@Component
class PushNotificationScheduler(private val pushNotificationService: PushNotificationService) {
    private val logger = LoggerFactory.getLogger(PushNotificationScheduler::class.java)

    @Scheduled(cron = "0 0 9 * * *", zone = "Asia/Seoul")
    fun runMorning() {
        runReminders("morning")
    }

    @Scheduled(cron = "0 0 18 * * *", zone = "Asia/Seoul")
    fun runEvening() {
        runReminders("evening")
    }

    private fun runReminders(label: String) {
        try {
            val result = pushNotificationService.sendReviewReminders(Instant.now())
            logger.info("pushNotification {} run result={}", label, result)
        } catch (e: Exception) {
            logger.error("pushNotification {} run failed", label, e)
        }
    }
}
