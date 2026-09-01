package com.japanese.vocabulary.auth.service

import org.springframework.stereotype.Service
import com.japanese.vocabulary.auth.dto.UsernameAvailabilityDto
import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.user.entity.UserEntity
import com.japanese.vocabulary.user.dto.UserDto
import com.japanese.vocabulary.user.dto.toDto
import com.japanese.vocabulary.user.repository.UserRepository
import com.japanese.vocabulary.user.service.UsernamePolicy
import org.springframework.transaction.annotation.Transactional

data class VerifiedAuthIdentity(
    val sub: String,
    val email: String?,
    val name: String?,
)

sealed class LoginResult {
    data class Authenticated(val user: UserDto) : LoginResult()
    data class NeedsSignup(val identity: VerifiedAuthIdentity) : LoginResult()
}

@Service
class AuthService(
    private val userRepository: UserRepository,
    private val googleOidcService: GoogleOidcService,
    private val appleOidcService: AppleOidcService,
) {
    fun googleLogin(idToken: String): LoginResult =
        login(provider = GOOGLE, identity = googleOidcService.verify(idToken).toAuthIdentity())

    fun appleLogin(idToken: String): LoginResult =
        login(provider = APPLE, identity = appleOidcService.verify(idToken).toAuthIdentity())

    private fun login(provider: String, identity: VerifiedAuthIdentity): LoginResult {
        val existing = userRepository.findByProviderAndProviderSub(provider, identity.sub)
            ?: return LoginResult.NeedsSignup(identity)
        existing.email = identity.email ?: existing.email
        val saved = userRepository.save(existing)
        return LoginResult.Authenticated(saved.toDto())
    }

    @Transactional
    fun googleSignup(idToken: String, username: String, displayName: String?): UserDto =
        signup(GOOGLE, googleOidcService.verify(idToken).toAuthIdentity(), username, displayName)

    @Transactional
    fun appleSignup(idToken: String, username: String, displayName: String?): UserDto =
        signup(APPLE, appleOidcService.verify(idToken).toAuthIdentity(), username, displayName)

    private fun signup(
        provider: String,
        identity: VerifiedAuthIdentity,
        username: String,
        displayName: String?,
    ): UserDto {
        val normalizedUsername = UsernamePolicy.normalize(username)
        UsernamePolicy.validate(normalizedUsername)

        // Idempotency: 같은 provider 계정으로 이미 가입돼 있으면 그 row 재사용 (retry / double-tap).
        userRepository.findByProviderAndProviderSub(provider, identity.sub)?.let {
            return it.toDto()
        }

        // Username 중복은 write 전에 read 로 확인.
        if (userRepository.findByUsername(normalizedUsername) != null) {
            throw BusinessException(ErrorCode.USERNAME_TAKEN)
        }

        val cleanedDisplayName = displayName?.trim()?.takeIf { it.isNotEmpty() }
        return userRepository.save(
            UserEntity(
                provider = provider,
                providerSub = identity.sub,
                username = normalizedUsername,
                email = identity.email,
                name = cleanedDisplayName,
            ),
        ).toDto()
    }

    fun checkUsername(username: String, currentUserId: Long? = null): UsernameAvailabilityDto {
        val normalized = UsernamePolicy.normalize(username)
        if (!UsernamePolicy.REGEX.matches(normalized)) return UsernameAvailabilityDto.INVALID_FORMAT
        if (normalized in UsernamePolicy.RESERVED) return UsernameAvailabilityDto.RESERVED
        val owner = userRepository.findByUsername(normalized)
        if (owner != null && owner.id != currentUserId) return UsernameAvailabilityDto.TAKEN
        return UsernameAvailabilityDto.AVAILABLE
    }

    private companion object {
        const val GOOGLE = "google"
        const val APPLE = "apple"
    }
}

private fun VerifiedGoogleIdentity.toAuthIdentity() = VerifiedAuthIdentity(
    sub = sub,
    email = email,
    name = name,
)

private fun VerifiedAppleIdentity.toAuthIdentity() = VerifiedAuthIdentity(
    sub = sub,
    email = email,
    name = name,
)
