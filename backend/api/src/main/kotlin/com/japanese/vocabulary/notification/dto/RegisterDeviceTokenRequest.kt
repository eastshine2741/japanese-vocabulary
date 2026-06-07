package com.japanese.vocabulary.notification.dto

data class RegisterDeviceTokenRequest(
    val token: String,
    val platform: String,
)
