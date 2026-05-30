package com.japanese.vocabulary.auth.dto

data class GoogleSignupRequest(
    val idToken: String,
    val username: String,
    val displayName: String? = null
)
