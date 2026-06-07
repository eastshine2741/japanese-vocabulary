package com.japanese.vocabulary.user.dto

data class RegisterDeviceTokenRequest(
    val token: String,
    val platform: String,
)
