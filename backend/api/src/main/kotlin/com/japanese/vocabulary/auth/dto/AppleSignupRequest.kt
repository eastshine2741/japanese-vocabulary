package com.japanese.vocabulary.auth.dto

data class AppleSignupRequest(
    val idToken: String,
    val username: String,
    val displayName: String? = null,
)
