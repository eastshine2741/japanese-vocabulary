package com.japanese.vocabulary.admin.dto

import java.time.Instant

data class AdminFeatureFlagResponse(
    val key: String,
    val startAt: Instant?,
    val endAt: Instant?,
    val description: String,
    val on: Boolean,
    val updatedAt: Instant?,
)
