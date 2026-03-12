package com.japanese.vocabulary.controller

import com.japanese.vocabulary.model.UserSettingsDTO
import com.japanese.vocabulary.service.UserSettingsService
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/settings")
class SettingsController(private val userSettingsService: UserSettingsService) {

    @GetMapping
    fun getSettings(): UserSettingsDTO {
        val userId = SecurityContextHolder.getContext().authentication.principal as Long
        return userSettingsService.getSettings(userId)
    }

    @PutMapping
    fun updateSettings(@RequestBody dto: UserSettingsDTO): UserSettingsDTO {
        val userId = SecurityContextHolder.getContext().authentication.principal as Long
        return userSettingsService.updateSettings(userId, dto)
    }
}
