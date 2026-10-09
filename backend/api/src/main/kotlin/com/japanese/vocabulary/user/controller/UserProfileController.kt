package com.japanese.vocabulary.user.controller

import com.japanese.vocabulary.user.dto.ConfirmProfileImageRequest
import com.japanese.vocabulary.user.dto.ProfileImageUploadUrlRequest
import com.japanese.vocabulary.user.dto.ProfileImageUploadUrlResponse
import com.japanese.vocabulary.user.dto.UpdateProfileRequest
import com.japanese.vocabulary.user.dto.UserProfileResponse
import com.japanese.vocabulary.user.dto.UserDto
import com.japanese.vocabulary.user.service.ProfileImageService
import com.japanese.vocabulary.user.service.UserProfileService
import org.springframework.http.HttpStatus
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/users/me")
class UserProfileController(
    private val userProfileService: UserProfileService,
    private val profileImageService: ProfileImageService,
) {
    @GetMapping
    fun getProfile(): UserProfileResponse {
        val userId = SecurityContextHolder.getContext().authentication.principal as Long
        return userProfileService.getProfile(userId).toResponse()
    }

    @PatchMapping
    fun updateProfile(@RequestBody request: UpdateProfileRequest): UserProfileResponse {
        val userId = SecurityContextHolder.getContext().authentication.principal as Long
        return userProfileService.updateProfile(userId, rawName = request.name, rawUsername = request.username)
            .toResponse()
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteSelf() {
        val userId = SecurityContextHolder.getContext().authentication.principal as Long
        profileImageService.deleteAccount(userId)
    }

    @PostMapping("/profile-image/upload-url")
    fun issueProfileImageUploadUrl(@RequestBody request: ProfileImageUploadUrlRequest): ProfileImageUploadUrlResponse {
        val userId = SecurityContextHolder.getContext().authentication.principal as Long
        return profileImageService.issueUploadUrl(userId, request.contentType)
    }

    @PutMapping("/profile-image")
    fun confirmProfileImage(@RequestBody request: ConfirmProfileImageRequest): UserProfileResponse {
        val userId = SecurityContextHolder.getContext().authentication.principal as Long
        return profileImageService.confirm(userId, request.key).toResponse()
    }

    @DeleteMapping("/profile-image")
    fun removeProfileImage(): UserProfileResponse {
        val userId = SecurityContextHolder.getContext().authentication.principal as Long
        return profileImageService.remove(userId).toResponse()
    }

    private fun UserDto.toResponse() = UserProfileResponse(
        username = username,
        name = name,
        email = email,
        profileImageUrl = profileImageService.publicUrl(profileImageKey),
    )
}
