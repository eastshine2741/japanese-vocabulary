package com.japanese.vocabulary.user.dto

import java.time.Instant

data class ProfileImageUploadUrlRequest(
    val contentType: String,
)

data class ProfileImageUploadUrlResponse(
    val key: String,
    val uploadUrl: String,
    /** Must be sent verbatim with the PUT; they are part of the signature. */
    val headers: Map<String, String>,
    val expiresAt: Instant,
)

data class ConfirmProfileImageRequest(
    val key: String,
)
