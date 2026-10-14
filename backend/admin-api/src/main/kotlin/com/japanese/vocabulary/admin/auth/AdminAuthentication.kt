package com.japanese.vocabulary.admin.auth

import org.springframework.security.authentication.AbstractAuthenticationToken
import java.time.Instant

/** [expiresAt] 은 로그인 토큰 만료 시각. 같은 세션에서 발급하는 파생 토큰이 이보다 먼저 죽지 않게 쓴다. */
class AdminAuthentication(val expiresAt: Instant) : AbstractAuthenticationToken(emptyList()) {
    init {
        isAuthenticated = true
    }

    override fun getCredentials(): Any? = null
    override fun getPrincipal(): Any = PRINCIPAL

    companion object {
        const val PRINCIPAL = "admin"
    }
}
