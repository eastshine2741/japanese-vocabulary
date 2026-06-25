package com.japanese.vocabulary.admin.dto

import java.time.Instant

data class AdminLoginResponse(
    val token: String,
    val expiresAt: Instant,
)
