package com.japanese.vocabulary.notification.dto

data class ManualPushResponse(
    val userId: Long,
    val targetTokens: Int,
    val sent: Int,
    val failed: Int,
)
