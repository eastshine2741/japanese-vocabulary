package com.japanese.vocabulary.auth.controller

import com.japanese.vocabulary.auth.dto.AuthResponse
import com.japanese.vocabulary.auth.dto.GoogleAuthRequest
import com.japanese.vocabulary.auth.dto.GoogleLoginResponse
import com.japanese.vocabulary.auth.dto.GoogleSignupRequest
import com.japanese.vocabulary.auth.dto.UsernameAvailabilityResponse
import com.japanese.vocabulary.auth.dto.VerifiedIdentityResponse
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.auth.dto.UsernameAvailabilityDto
import com.japanese.vocabulary.auth.service.AuthService
import com.japanese.vocabulary.auth.service.GoogleLoginResult
import com.japanese.vocabulary.user.dto.UserDto
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
    private val authService: AuthService,
    private val jwtUtil: JwtUtil,
) {
    @PostMapping("/google")
    fun googleLogin(@RequestBody request: GoogleAuthRequest): GoogleLoginResponse =
        when (val result = authService.googleLogin(request.idToken)) {
            is GoogleLoginResult.Authenticated -> GoogleLoginResponse.authenticated(result.user.toAuthResponse())
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
        authService.signup(request.idToken, request.username, request.displayName).toAuthResponse()

    @GetMapping("/username/available")
    fun checkUsername(@RequestParam("username") username: String): UsernameAvailabilityResponse {
        val principal = SecurityContextHolder.getContext().authentication?.principal as? Long
        return authService.checkUsername(username, currentUserId = principal).toResponse()
    }

    private fun UserDto.toAuthResponse(): AuthResponse {
        val jwtLabel = name ?: username
        return AuthResponse(
            token = jwtUtil.generateToken(id, jwtLabel),
            username = username,
            name = name,
        )
    }

    private fun UsernameAvailabilityDto.toResponse(): UsernameAvailabilityResponse = when (this) {
        UsernameAvailabilityDto.AVAILABLE -> UsernameAvailabilityResponse(true)
        UsernameAvailabilityDto.INVALID_FORMAT ->
            UsernameAvailabilityResponse(false, UsernameAvailabilityResponse.REASON_INVALID_FORMAT)
        UsernameAvailabilityDto.RESERVED ->
            UsernameAvailabilityResponse(false, UsernameAvailabilityResponse.REASON_RESERVED)
        UsernameAvailabilityDto.TAKEN ->
            UsernameAvailabilityResponse(false, UsernameAvailabilityResponse.REASON_TAKEN)
    }
}
