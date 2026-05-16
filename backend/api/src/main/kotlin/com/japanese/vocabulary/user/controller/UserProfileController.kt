package com.japanese.vocabulary.user.controller

import com.japanese.vocabulary.user.dto.UpdateProfileRequest
import com.japanese.vocabulary.user.dto.UserProfileResponse
import com.japanese.vocabulary.user.service.UserProfileService
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/users/me")
class UserProfileController(
    private val userProfileService: UserProfileService,
) {
    @PatchMapping
    fun updateProfile(@RequestBody request: UpdateProfileRequest): UserProfileResponse {
        val userId = SecurityContextHolder.getContext().authentication.principal as Long
        return userProfileService.updateName(userId, request.name)
    }
}
