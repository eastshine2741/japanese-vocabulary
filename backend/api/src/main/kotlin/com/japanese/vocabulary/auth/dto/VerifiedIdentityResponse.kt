package com.japanese.vocabulary.auth.dto

data class VerifiedIdentityResponse(
    val sub: String,
    val email: String?,
    val name: String?
)
