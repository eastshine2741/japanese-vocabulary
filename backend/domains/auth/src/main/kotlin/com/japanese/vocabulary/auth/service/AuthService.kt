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

sealed class GoogleLoginResult {
    data class Authenticated(val user: UserDto) : GoogleLoginResult()
    data class NeedsSignup(val identity: VerifiedGoogleIdentity) : GoogleLoginResult()
}

@Service
class AuthService(
    private val userRepository: UserRepository,
    private val googleOidcService: GoogleOidcService,
) {
    fun googleLogin(idToken: String): GoogleLoginResult {
        val identity = googleOidcService.verify(idToken)
        val existing = userRepository.findByProviderAndProviderSub(GOOGLE, identity.sub)
            ?: return GoogleLoginResult.NeedsSignup(identity)
        existing.email = identity.email ?: existing.email
        val saved = userRepository.save(existing)
        return GoogleLoginResult.Authenticated(saved.toDto())
    }

    @Transactional
    fun signup(idToken: String, username: String, displayName: String?): UserDto {
        val identity = googleOidcService.verify(idToken)
        val normalizedUsername = UsernamePolicy.normalize(username)
        UsernamePolicy.validate(normalizedUsername)

        // Idempotency: 같은 Google 계정으로 이미 가입돼 있으면 그 row 재사용 (retry / double-tap).
        userRepository.findByProviderAndProviderSub(GOOGLE, identity.sub)?.let {
            return it.toDto()
        }

        // Username 중복은 write 전에 read 로 확인.
        if (userRepository.findByUsername(normalizedUsername) != null) {
            throw BusinessException(ErrorCode.USERNAME_TAKEN)
        }

        val cleanedDisplayName = displayName?.trim()?.takeIf { it.isNotEmpty() }
        return userRepository.save(
            UserEntity(
                provider = GOOGLE,
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
    }
}
