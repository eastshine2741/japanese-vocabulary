package com.japanese.vocabulary.notification

import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import com.japanese.vocabulary.notification.dto.ManualPushRequest
import com.japanese.vocabulary.notification.dto.ManualPushResponse
import java.security.MessageDigest

/**
 * Manual push operations. Active in every environment (dev + prod) for now. Safe in prod only
 * because the batch `Service` has no Ingress/LB — the endpoint is reachable from inside the
 * cluster only. To be moved to a dedicated admin service with proper auth in a follow-up.
 */
@RestController
@RequestMapping("/dev/push")
@ConditionalOnProperty(name = ["push.firebase.enabled"], havingValue = "true")
class ReviewReminderDevController(
    private val pushNotificationScheduler: ReviewReminderScheduler,
    private val manualPushNotificationService: ManualPushNotificationService,
    @Value("\${push.manual.secret:}") private val manualPushSecret: String,
) {
    private val logger = LoggerFactory.getLogger(ReviewReminderDevController::class.java)

    data class TriggerResponse(val sent: Int, val failed: Int)

    @PostMapping("/trigger")
    fun trigger(): TriggerResponse {
        val result = pushNotificationScheduler.dispatch()
        logger.info("pushNotification manual trigger result={}", result)
        return TriggerResponse(sent = result.sent, failed = result.failed)
    }

    @PostMapping("/send")
    fun send(
        @RequestHeader("X-Manual-Push-Secret", required = false) secret: String?,
        @RequestBody request: ManualPushRequest,
    ): ManualPushResponse {
        requireManualPushSecret(secret)
        val result = manualPushNotificationService.send(request)
        logger.info("pushNotification manual send result={}", result)
        return result
    }

    private fun requireManualPushSecret(secret: String?) {
        if (manualPushSecret.isBlank() || secret.isNullOrBlank()) throw forbidden()
        val expected = manualPushSecret.toByteArray(Charsets.UTF_8)
        val actual = secret.toByteArray(Charsets.UTF_8)
        if (!MessageDigest.isEqual(expected, actual)) throw forbidden()
    }

    private fun forbidden() = ResponseStatusException(HttpStatus.FORBIDDEN, "manual push secret invalid")
}
