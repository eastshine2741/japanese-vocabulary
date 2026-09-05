package com.japanese.vocabulary.notification.controller

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.notification.dto.AnalysisNotificationRequest
import com.japanese.vocabulary.notification.dto.AnalysisNotificationResponse
import com.japanese.vocabulary.notification.service.AnalysisNotificationService
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/songs/{songId}/analysis-notifications")
class AnalysisNotificationController(private val service: AnalysisNotificationService) {
    @PostMapping
    fun update(
        @PathVariable songId: Long,
        @RequestBody request: AnalysisNotificationRequest,
    ): AnalysisNotificationResponse {
        val enabled = request.enabled ?: throw BusinessException(ErrorCode.INVALID_NOTIFICATION_REQUEST)
        val userId = SecurityContextHolder.getContext().authentication.principal as Long
        return service.update(userId, songId, enabled)
    }
}
