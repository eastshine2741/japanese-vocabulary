package com.japanese.vocabulary.auth.dto

data class UsernameAvailabilityResponse(
    val available: Boolean,
    val reason: String? = null,
) {
    companion object {
        const val REASON_INVALID_FORMAT = "INVALID_FORMAT"
        const val REASON_RESERVED = "RESERVED"
        const val REASON_TAKEN = "TAKEN"
    }
}
