package com.japanese.vocabulary.auth.controller

import com.japanese.vocabulary.auth.service.AuthService
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val authService: AuthService
) {
    // POST /api/auth/google added in US-004 (Google OIDC ID token exchange).
}
