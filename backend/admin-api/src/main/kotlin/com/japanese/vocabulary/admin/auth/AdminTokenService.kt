package com.japanese.vocabulary.admin.auth

import com.japanese.vocabulary.admin.config.AdminSecurityProperties
import io.jsonwebtoken.Claims
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.springframework.stereotype.Component
import java.nio.charset.StandardCharsets
import java.time.Clock
import java.time.Duration
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
        val claims = parse(token) ?: return null
        return if (claims.subject == AdminAuthentication.PRINCIPAL && claims["scope"] == "admin") claims else null
    }

    /**
     * 릴스 미리보기 `<video src>` 용 토큰. 브라우저 video 태그는 Authorization 헤더를 못 붙여서 query 로 넘긴다.
     * 어드민 토큰이 URL·접근 로그에 남지 않도록 곡 하나의 MV 스트림에만 쓰이는 짧은 토큰을 따로 발급한다.
     */
    fun issueMediaToken(songId: Long): String {
        val now = Instant.now(clock)
        return Jwts.builder()
            .subject(AdminAuthentication.PRINCIPAL)
            .claim("scope", MEDIA_SCOPE)
            .claim("songId", songId)
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plus(MEDIA_TOKEN_TTL)))
            .signWith(key)
            .compact()
    }

    fun validateMediaToken(token: String, songId: Long): Boolean {
        val claims = parse(token) ?: return false
        return claims.subject == AdminAuthentication.PRINCIPAL &&
            claims["scope"] == MEDIA_SCOPE &&
            claims.get("songId", Long::class.javaObjectType) == songId
    }

    private fun parse(token: String): Claims? {
        return try {
            Jwts.parser()
                .clock { Date.from(Instant.now(clock)) }
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .payload
        } catch (e: Exception) {
            null
        }
    }

    companion object {
        const val MEDIA_SCOPE = "reels-mv"
        val MEDIA_TOKEN_TTL: Duration = Duration.ofMinutes(30)
    }
}

data class AdminIssuedToken(
    val token: String,
    val expiresAt: Instant,
)
