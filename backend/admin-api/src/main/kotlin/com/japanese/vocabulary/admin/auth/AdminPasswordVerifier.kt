package com.japanese.vocabulary.admin.auth

import com.japanese.vocabulary.admin.config.AdminSecurityProperties
import org.springframework.stereotype.Component
import java.security.MessageDigest

@Component
class AdminPasswordVerifier(
    private val properties: AdminSecurityProperties,
) {
    fun matches(candidate: String): Boolean {
        val expectedHash = properties.passwordSha256.trim()
        if (expectedHash.isNotEmpty()) {
            return constantTimeEquals(sha256(candidate), expectedHash.lowercase())
        }
        if (properties.password.isEmpty()) {
            return false
        }
        return constantTimeEquals(candidate, properties.password)
    }

    private fun sha256(value: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }

    private fun constantTimeEquals(left: String, right: String): Boolean {
        return MessageDigest.isEqual(
            left.toByteArray(Charsets.UTF_8),
            right.toByteArray(Charsets.UTF_8),
        )
    }
}
