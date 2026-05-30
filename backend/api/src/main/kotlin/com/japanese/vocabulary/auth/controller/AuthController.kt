package com.japanese.vocabulary.auth.controller

import com.japanese.vocabulary.auth.dto.AuthResponse
import com.japanese.vocabulary.auth.dto.GoogleAuthRequest
import com.japanese.vocabulary.auth.dto.GoogleLoginResponse
import com.japanese.vocabulary.auth.dto.GoogleSignupRequest
import com.japanese.vocabulary.auth.dto.UsernameAvailabilityResponse
import com.japanese.vocabulary.auth.dto.VerifiedIdentityResponse
import com.japanese.vocabulary.auth.service.AuthService
import com.japanese.vocabulary.auth.service.GoogleLoginResult
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val authService: AuthService
) {
    @PostMapping("/google")
    fun googleLogin(@RequestBody request: GoogleAuthRequest): GoogleLoginResponse =
        when (val result = authService.googleLogin(request.idToken)) {
            is GoogleLoginResult.Authenticated -> GoogleLoginResponse.authenticated(result.auth)
            is GoogleLoginResult.NeedsSignup -> GoogleLoginResponse.needsSignup(
                VerifiedIdentityResponse(
                    sub = result.identity.sub,
                    email = result.identity.email,
                    name = result.identity.name,
                )
            )
        }

    @PostMapping("/google/signup")
    fun googleSignup(@RequestBody request: GoogleSignupRequest): AuthResponse =
        authService.signup(request.idToken, request.username, request.displayName)

    @GetMapping("/username/available")
    fun checkUsername(@RequestParam("username") username: String): UsernameAvailabilityResponse {
        val principal = SecurityContextHolder.getContext().authentication?.principal as? Long
        return authService.checkUsername(username, currentUserId = principal)
    }
}
