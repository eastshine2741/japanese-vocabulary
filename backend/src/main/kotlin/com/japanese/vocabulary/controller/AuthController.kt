package com.japanese.vocabulary.controller

import com.japanese.vocabulary.auth.AuthService
import com.japanese.vocabulary.model.AuthRequest
import com.japanese.vocabulary.model.AuthResponse
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
