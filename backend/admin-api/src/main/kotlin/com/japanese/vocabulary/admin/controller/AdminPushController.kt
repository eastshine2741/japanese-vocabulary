package com.japanese.vocabulary.admin.controller

import com.japanese.vocabulary.admin.push.ManualPushNotificationService
import com.japanese.vocabulary.admin.push.dto.ManualPushRequest
import com.japanese.vocabulary.admin.push.dto.ManualPushResponse
import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 운영자가 특정 유저에게 푸시를 직접 보낸다. batch 의 `/dev/push` 를 대체하며, 공유 시크릿 대신
 * admin-api 의 토큰 인증을 그대로 쓴다 (SecurityConfig 가 `/admin/api` 하위를 authenticated 로 묶는다).
 */
@RestController
@RequestMapping("/admin/api/push")
@ConditionalOnProperty(name = ["push.firebase.enabled"], havingValue = "true")
class AdminPushController(
    private val manualPushNotificationService: ManualPushNotificationService,
) {
    private val logger = LoggerFactory.getLogger(AdminPushController::class.java)

    @PostMapping("/send")
    fun send(@RequestBody request: ManualPushRequest): ManualPushResponse {
        val result = manualPushNotificationService.send(request)
        logger.info("admin manual push result={}", result)
        return result
    }
}
