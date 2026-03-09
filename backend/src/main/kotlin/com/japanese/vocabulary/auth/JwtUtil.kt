package com.japanese.vocabulary.auth

import io.jsonwebtoken.Claims
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.nio.charset.StandardCharsets
import java.util.*

@Component
class JwtUtil(
    @Value("\${jwt.secret}") private val secret: String
) {
    private val key by lazy {
        Keys.hmacShaKeyFor(secret.toByteArray(StandardCharsets.UTF_8))
    }

    fun generateToken(userId: Long, name: String): String {
        val now = Date()
        val expiry = Date(now.time + 30L * 24 * 60 * 60 * 1000) // 30 days

        return Jwts.builder()
            .subject(userId.toString())
            .claim("name", name)
            .issuedAt(now)
            .expiration(expiry)
            .signWith(key)
            .compact()
    }

    fun validateToken(token: String): Claims? {
        return try {
            Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .payload
        } catch (e: Exception) {
            null
        }
    }

    fun getUserId(token: String): Long {
        val claims = validateToken(token) ?: throw IllegalArgumentException("Invalid token")
        return claims.subject.toLong()
    }
}
