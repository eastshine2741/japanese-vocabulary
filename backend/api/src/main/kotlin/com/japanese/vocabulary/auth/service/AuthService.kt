package com.japanese.vocabulary.auth.service

import com.japanese.vocabulary.auth.dto.AuthResponse
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.user.entity.UserEntity
import com.japanese.vocabulary.user.repository.UserRepository
import org.springframework.stereotype.Service

@Service
class AuthService(
    private val userRepository: UserRepository,
    private val googleOidcService: GoogleOidcService,
    private val jwtUtil: JwtUtil
) {
    fun googleLogin(idToken: String): AuthResponse {
        val identity = googleOidcService.verify(idToken)
        val user = userRepository.findByProviderAndProviderSub(GOOGLE, identity.sub)?.let { existing ->
            existing.email = identity.email ?: existing.email
            existing.name = identity.name ?: existing.name
            userRepository.save(existing)
        } ?: userRepository.save(
            UserEntity(
                provider = GOOGLE,
                providerSub = identity.sub,
                email = identity.email,
                name = identity.name ?: identity.email ?: "User"
            )
        )
        return AuthResponse(
            token = jwtUtil.generateToken(user.id!!, user.name),
            name = user.name
        )
    }

    private companion object {
        const val GOOGLE = "google"
    }
}
