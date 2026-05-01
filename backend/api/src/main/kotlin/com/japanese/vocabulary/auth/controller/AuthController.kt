package com.japanese.vocabulary.auth.controller

import com.japanese.vocabulary.auth.dto.AuthResponse
import com.japanese.vocabulary.auth.dto.GoogleAuthRequest
import com.japanese.vocabulary.auth.service.AuthService
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val authService: AuthService
) {
    @PostMapping("/google")
    fun googleLogin(@RequestBody request: GoogleAuthRequest): AuthResponse =
        authService.googleLogin(request.idToken)
}
