package com.japanese.vocabulary.notification

import org.slf4j.LoggerFactory
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * Manual trigger for the review-reminder dispatch. Active in every environment (dev + prod) for
 * now. Safe in prod only because the batch `Service` has no Ingress/LB — the endpoint is reachable
 * from inside the cluster only. To be moved to a dedicated admin service with proper auth in a
 * follow-up.
 */
@RestController
@RequestMapping("/dev/push")
class ReviewReminderDevController(
    private val pushNotificationScheduler: ReviewReminderScheduler,
) {
    private val logger = LoggerFactory.getLogger(ReviewReminderDevController::class.java)

    data class TriggerResponse(val sent: Int, val failed: Int)

    @PostMapping("/trigger")
    fun trigger(): TriggerResponse {
        val result = pushNotificationScheduler.dispatch()
        logger.info("pushNotification manual trigger result={}", result)
        return TriggerResponse(sent = result.sent, failed = result.failed)
    }
}
