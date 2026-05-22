package com.japanese.vocabulary.auth.dto

data class AuthResponse(
    val token: String,
    val username: String,
    val name: String?,
)
