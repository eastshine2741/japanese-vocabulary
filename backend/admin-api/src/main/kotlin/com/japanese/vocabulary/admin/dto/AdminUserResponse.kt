package com.japanese.vocabulary.admin.dto

import java.time.Instant

data class AdminUserResponse(
    val id: Long,
    val provider: String,
    val username: String,
    val email: String?,
    val name: String?,
    val createdAt: Instant?,
    val deletedAt: Instant?,
)
