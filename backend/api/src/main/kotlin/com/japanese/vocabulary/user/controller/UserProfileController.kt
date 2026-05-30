package com.japanese.vocabulary.user.controller

import com.japanese.vocabulary.user.dto.UpdateProfileRequest
import com.japanese.vocabulary.user.dto.UserProfileResponse
import com.japanese.vocabulary.user.service.UserProfileService
import org.springframework.http.HttpStatus
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/users/me")
class UserProfileController(
    private val userProfileService: UserProfileService,
) {
    @PatchMapping
    fun updateProfile(@RequestBody request: UpdateProfileRequest): UserProfileResponse {
        val userId = SecurityContextHolder.getContext().authentication.principal as Long
        return userProfileService.updateProfile(userId, rawName = request.name, rawUsername = request.username)
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteSelf() {
        val userId = SecurityContextHolder.getContext().authentication.principal as Long
        userProfileService.deleteSelf(userId)
    }
}
