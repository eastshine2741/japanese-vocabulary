package com.japanese.vocabulary.auth.service

import com.japanese.vocabulary.auth.dto.AuthResponse
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.user.entity.UserEntity
import com.japanese.vocabulary.user.repository.UserRepository
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Service

@Service
class AuthService(
    private val userRepository: UserRepository,
    private val googleOidcService: GoogleOidcService,
    private val jwtUtil: JwtUtil
) {
    fun googleLogin(idToken: String): AuthResponse {
        val identity = googleOidcService.verify(idToken)
        val user = upsertGoogleUser(identity)
        return AuthResponse(
            token = jwtUtil.generateToken(user.id!!, user.name),
            name = user.name
        )
    }

    private fun upsertGoogleUser(identity: VerifiedGoogleIdentity): UserEntity {
        userRepository.findByProviderAndProviderSub(GOOGLE, identity.sub)?.let { existing ->
            existing.email = identity.email ?: existing.email
            existing.name = identity.name ?: existing.name
            return userRepository.save(existing)
        }
        return try {
            userRepository.save(
                UserEntity(
                    provider = GOOGLE,
                    providerSub = identity.sub,
                    email = identity.email,
                    name = identity.name ?: identity.email ?: "User"
                )
            )
        } catch (e: DataIntegrityViolationException) {
            // Concurrent first sign-in raced us; the row now exists.
            userRepository.findByProviderAndProviderSub(GOOGLE, identity.sub) ?: throw e
        }
    }

    private companion object {
        const val GOOGLE = "google"
    }
}
