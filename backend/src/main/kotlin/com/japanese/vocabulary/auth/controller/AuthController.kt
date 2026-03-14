package com.japanese.vocabulary.auth.controller

import com.japanese.vocabulary.auth.dto.AuthRequest
import com.japanese.vocabulary.auth.dto.AuthResponse
import com.japanese.vocabulary.auth.service.AuthService
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val authService: AuthService
) {
    @PostMapping("/signup")
    fun signup(@RequestBody request: AuthRequest): AuthResponse {
        val token = authService.signup(request.name, request.password)
        return AuthResponse(token)
    }

    @PostMapping("/login")
    fun login(@RequestBody request: AuthRequest): AuthResponse {
        val token = authService.login(request.name, request.password)
        return AuthResponse(token)
    }
}
