package com.japanese.autoconfigure.auth

import com.japanese.vocabulary.auth.jwt.JwtAuthFilter
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.auth.service.AuthService
import com.japanese.vocabulary.auth.service.GoogleOidcService
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.context.annotation.Import

@AutoConfiguration
@Import(AuthService::class, GoogleOidcService::class, JwtAuthFilter::class, JwtUtil::class)
class AuthAutoConfiguration
