package com.japanese.vocabulary.auth.dto

/**
 * Result of [com.japanese.vocabulary.auth.service.AuthService.checkUsername].
 * Bootstrap modules map this to whatever HTTP shape they need.
 */
enum class UsernameAvailabilityDto {
    AVAILABLE,
    INVALID_FORMAT,
    RESERVED,
    TAKEN,
}
