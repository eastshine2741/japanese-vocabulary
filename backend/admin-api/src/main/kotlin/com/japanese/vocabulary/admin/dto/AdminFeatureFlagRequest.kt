package com.japanese.vocabulary.admin.dto

import java.time.Instant

data class AdminFeatureFlagRequest(
    val startAt: Instant?,
    val endAt: Instant?,
    val description: String = "",
)
