package com.japanese.vocabulary.admin.controller

import com.japanese.vocabulary.admin.auth.AdminPasswordVerifier
import com.japanese.vocabulary.admin.auth.AdminTokenService
import com.japanese.vocabulary.admin.dto.AdminLoginRequest
import com.japanese.vocabulary.admin.dto.AdminLoginResponse
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/admin/api/auth")
class AdminAuthController(
    private val passwordVerifier: AdminPasswordVerifier,
    private val tokenService: AdminTokenService,
) {
    @PostMapping("/login")
    fun login(@RequestBody request: AdminLoginRequest): ResponseEntity<AdminLoginResponse> {
        if (!passwordVerifier.matches(request.password)) {
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED)
        }
        val token = tokenService.issueToken()
        return ResponseEntity.ok(AdminLoginResponse(token = token.token, expiresAt = token.expiresAt))
    }
}
