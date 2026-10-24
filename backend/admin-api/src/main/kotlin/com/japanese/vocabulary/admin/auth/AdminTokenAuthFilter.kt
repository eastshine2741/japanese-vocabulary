package com.japanese.vocabulary.admin.auth

import com.japanese.vocabulary.admin.config.AdminSecurityProperties
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import java.security.MessageDigest

@Component
class AdminTokenAuthFilter(
    private val adminTokenService: AdminTokenService,
    private val properties: AdminSecurityProperties,
) : OncePerRequestFilter() {
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val authHeader = request.getHeader("Authorization")
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            val token = authHeader.removePrefix("Bearer ")
            SecurityContextHolder.getContext().authentication = when {
                isLyricSyncAgentToken(token) -> LyricSyncAgentAuthentication()
                else -> adminTokenService.validate(token)?.let { AdminAuthentication(it.expiration.toInstant()) }
            }
        }
        filterChain.doFilter(request, response)
    }

    private fun isLyricSyncAgentToken(token: String): Boolean {
        val expected = properties.lyricSyncAgentToken
        return expected.isNotEmpty() && MessageDigest.isEqual(expected.toByteArray(), token.toByteArray())
    }
}
