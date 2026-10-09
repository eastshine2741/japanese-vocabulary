package com.japanese.vocabulary.user.dto

data class UserProfileResponse(
    val username: String,
    val name: String?,
    val email: String?,
    val profileImageUrl: String? = null,
)
