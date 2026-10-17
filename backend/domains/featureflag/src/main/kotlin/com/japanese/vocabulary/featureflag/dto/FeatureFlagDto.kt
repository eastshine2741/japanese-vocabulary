package com.japanese.vocabulary.featureflag.dto

import java.time.Instant

data class FeatureFlagDto(
    val key: String,
    val startAt: Instant?,
    val endAt: Instant?,
    val description: String,
    val on: Boolean,
    val updatedAt: Instant?,
)
