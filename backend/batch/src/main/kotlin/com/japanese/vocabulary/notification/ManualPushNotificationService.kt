package com.japanese.vocabulary.notification

import com.japanese.vocabulary.notification.dto.ManualPushRequest
import com.japanese.vocabulary.notification.dto.ManualPushResponse
import com.japanese.vocabulary.notification.repository.DeviceTokenRepository
import com.japanese.vocabulary.notification.service.PushNotificationService
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.server.ResponseStatusException

@Service
@ConditionalOnProperty(name = ["push.firebase.enabled"], havingValue = "true")
class ManualPushNotificationService(
    private val deviceTokenRepository: DeviceTokenRepository,
    private val pushNotificationService: PushNotificationService,
) {
    fun send(request: ManualPushRequest): ManualPushResponse {
        val title = request.title.trim()
        val body = request.body.trim()
        if (request.userId <= 0) throw badRequest("userId must be positive")
        if (title.isBlank()) throw badRequest("title must not be blank")
        if (body.isBlank()) throw badRequest("body must not be blank")

        val tokens = deviceTokenRepository.findAllByUserId(request.userId)
        var sent = 0
        var failed = 0
        for (token in tokens) {
            if (
                pushNotificationService.send(
                    userId = request.userId,
                    token = token.token,
                    title = title,
                    body = body,
                    data = request.data,
                )
            ) {
                sent++
            } else {
                failed++
            }
        }
        return ManualPushResponse(
            userId = request.userId,
            targetTokens = tokens.size,
            sent = sent,
            failed = failed,
        )
    }

    private fun badRequest(message: String) = ResponseStatusException(HttpStatus.BAD_REQUEST, message)
}
