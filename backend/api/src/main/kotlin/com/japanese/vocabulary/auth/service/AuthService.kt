package com.japanese.vocabulary.auth.service

import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.user.repository.UserRepository
import org.springframework.stereotype.Service

@Service
class AuthService(
    private val userRepository: UserRepository,
    private val jwtUtil: JwtUtil
) {
    // signup/login removed in US-002. Google OIDC verify + JWT issuance added in US-003 / US-004.
}
