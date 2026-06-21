package com.japanese.vocabulary.admin.auth

import com.japanese.vocabulary.admin.config.AdminSecurityProperties
import io.jsonwebtoken.Claims
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.springframework.stereotype.Component
import java.nio.charset.StandardCharsets
import java.time.Clock
import java.time.Instant
import java.util.Date

@Component
class AdminTokenService(
    private val properties: AdminSecurityProperties,
    private val clock: Clock = Clock.systemUTC(),
) {
    private val key by lazy {
        Keys.hmacShaKeyFor(properties.tokenSecret.toByteArray(StandardCharsets.UTF_8))
    }

    fun issueToken(): AdminIssuedToken {
        val now = Instant.now(clock)
        val expiresAt = now.plusSeconds(properties.tokenTtlMinutes * 60)
        val token = Jwts.builder()
            .subject(AdminAuthentication.PRINCIPAL)
            .claim("scope", "admin")
            .issuedAt(Date.from(now))
            .expiration(Date.from(expiresAt))
            .signWith(key)
            .compact()

        return AdminIssuedToken(token = token, expiresAt = expiresAt)
    }

    fun validate(token: String): Claims? {
        return try {
            val claims = Jwts.parser()
                .clock { Date.from(Instant.now(clock)) }
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .payload
            if (claims.subject == AdminAuthentication.PRINCIPAL && claims["scope"] == "admin") claims else null
        } catch (e: Exception) {
            null
        }
    }
}

data class AdminIssuedToken(
    val token: String,
    val expiresAt: Instant,
)
