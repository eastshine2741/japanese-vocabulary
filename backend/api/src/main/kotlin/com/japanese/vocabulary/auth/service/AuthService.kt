package com.japanese.vocabulary.auth.service

import com.japanese.vocabulary.auth.dto.AuthResponse
import com.japanese.vocabulary.auth.dto.UsernameAvailabilityResponse
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.user.entity.UserEntity
import com.japanese.vocabulary.user.repository.UserRepository
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Service

sealed class GoogleLoginResult {
    data class Authenticated(val auth: AuthResponse) : GoogleLoginResult()
    data class NeedsSignup(val identity: VerifiedGoogleIdentity) : GoogleLoginResult()
}

@Service
class AuthService(
    private val userRepository: UserRepository,
    private val googleOidcService: GoogleOidcService,
    private val jwtUtil: JwtUtil
) {
    fun googleLogin(idToken: String): GoogleLoginResult {
        val identity = googleOidcService.verify(idToken)
        val existing = userRepository.findByProviderAndProviderSub(GOOGLE, identity.sub)
            ?: return GoogleLoginResult.NeedsSignup(identity)
        existing.email = identity.email ?: existing.email
        val saved = userRepository.save(existing)
        return GoogleLoginResult.Authenticated(saved.toAuthResponse())
    }

    fun signup(idToken: String, username: String, displayName: String?): AuthResponse {
        val identity = googleOidcService.verify(idToken)
        val normalizedUsername = normalizeUsername(username)
        validateUsername(normalizedUsername)

        // Idempotency: if a row already exists for this Google identity (e.g. retry / double-tap),
        // reuse it instead of failing on the (provider, sub) unique constraint.
        userRepository.findByProviderAndProviderSub(GOOGLE, identity.sub)?.let {
            return it.toAuthResponse()
        }

        val cleanedDisplayName = displayName?.trim()?.takeIf { it.isNotEmpty() }
        return try {
            userRepository.save(
                UserEntity(
                    provider = GOOGLE,
                    providerSub = identity.sub,
                    username = normalizedUsername,
                    email = identity.email,
                    name = cleanedDisplayName
                )
            ).toAuthResponse()
        } catch (e: DataIntegrityViolationException) {
            // Either username collided, or another concurrent first sign-in won the (provider, sub)
            // race for this Google account. Distinguish by querying.
            userRepository.findByProviderAndProviderSub(GOOGLE, identity.sub)?.let {
                return it.toAuthResponse()
            }
            if (userRepository.findByUsername(normalizedUsername) != null) {
                throw BusinessException(ErrorCode.USERNAME_TAKEN)
            }
            throw e
        }
    }

    fun checkUsername(username: String): UsernameAvailabilityResponse {
        val normalized = normalizeUsername(username)
        if (!USERNAME_REGEX.matches(normalized)) {
            return UsernameAvailabilityResponse(false, UsernameAvailabilityResponse.REASON_INVALID_FORMAT)
        }
        if (normalized in RESERVED_USERNAMES) {
            return UsernameAvailabilityResponse(false, UsernameAvailabilityResponse.REASON_RESERVED)
        }
        if (userRepository.findByUsername(normalized) != null) {
            return UsernameAvailabilityResponse(false, UsernameAvailabilityResponse.REASON_TAKEN)
        }
        return UsernameAvailabilityResponse(true)
    }

    private fun normalizeUsername(raw: String): String = raw.trim().lowercase()

    private fun validateUsername(username: String) {
        if (!USERNAME_REGEX.matches(username)) {
            throw BusinessException(ErrorCode.INVALID_USERNAME)
        }
        if (username in RESERVED_USERNAMES) {
            throw BusinessException(ErrorCode.RESERVED_USERNAME)
        }
    }

    private fun UserEntity.toAuthResponse(): AuthResponse {
        val displayLabel = name ?: username
        return AuthResponse(
            token = jwtUtil.generateToken(id!!, displayLabel),
            name = displayLabel
        )
    }

    private companion object {
        const val GOOGLE = "google"
        val USERNAME_REGEX = Regex("^[a-z0-9_]{3,20}$")
        val RESERVED_USERNAMES = setOf("admin", "root", "api", "system", "null", "undefined")
    }
}
