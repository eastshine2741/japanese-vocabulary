package com.japanese.vocabulary.user.controller

import com.japanese.vocabulary.user.model.UserSettingsData
import com.japanese.vocabulary.user.service.UserSettingsService
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/settings")
class SettingsController(private val userSettingsService: UserSettingsService) {

    @GetMapping
    fun getSettings(): UserSettingsData {
        val userId = SecurityContextHolder.getContext().authentication.principal as Long
        return userSettingsService.getSettings(userId)
    }

    @PutMapping
    fun updateSettings(@RequestBody data: UserSettingsData): UserSettingsData {
        val userId = SecurityContextHolder.getContext().authentication.principal as Long
        return userSettingsService.updateSettings(userId, data)
    }
}
