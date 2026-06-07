package com.japanese.vocabulary.notification.controller

import com.japanese.vocabulary.notification.dto.RegisterDeviceTokenRequest
import com.japanese.vocabulary.notification.dto.UnregisterDeviceTokenRequest
import com.japanese.vocabulary.notification.service.DeviceTokenService
import org.springframework.http.HttpStatus
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/users/me/device-tokens")
class DeviceTokenController(
    private val deviceTokenService: DeviceTokenService,
) {
    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun register(@RequestBody request: RegisterDeviceTokenRequest) {
        val userId = SecurityContextHolder.getContext().authentication.principal as Long
        deviceTokenService.register(userId, request.token, request.platform)
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun unregister(@RequestBody request: UnregisterDeviceTokenRequest) {
        // Auth required at filter layer; not bound to caller's userId because the token may
        // already have migrated to another user (re-login on shared device).
        SecurityContextHolder.getContext().authentication.principal as Long
        deviceTokenService.unregister(request.token)
    }
}
