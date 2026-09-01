package com.japanese.vocabulary.auth.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.jwk.source.RemoteJWKSet
import com.nimbusds.jose.proc.JWSVerificationKeySelector
import com.nimbusds.jose.proc.SecurityContext
import com.nimbusds.jwt.proc.DefaultJWTClaimsVerifier
import com.nimbusds.jwt.proc.DefaultJWTProcessor
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.net.URL

data class VerifiedAppleIdentity(
    val sub: String,
    val email: String?,
    val name: String?,
)

@Service
class AppleOidcService(
    @Value("\${apple.oauth.client-id}") private val audienceClientId: String,
) {
    private val jwtProcessor: DefaultJWTProcessor<SecurityContext> by lazy {
        DefaultJWTProcessor<SecurityContext>().apply {
            jwsKeySelector = JWSVerificationKeySelector(
                JWSAlgorithm.RS256,
                RemoteJWKSet(URL(APPLE_KEYS_URL)),
            )
            jwtClaimsSetVerifier = DefaultJWTClaimsVerifier(
                null,
                setOf("iss", "sub", "aud", "exp", "iat"),
            )
        }
    }

    fun verify(idTokenString: String): VerifiedAppleIdentity {
        if (audienceClientId.isBlank()) {
            throw BusinessException(ErrorCode.INVALID_CREDENTIALS)
        }
        val claims = runCatching { jwtProcessor.process(idTokenString, null) }
            .getOrNull()
            ?: throw BusinessException(ErrorCode.INVALID_CREDENTIALS)

        val issuer = claims.issuer
        val audiences = claims.audience.orEmpty()
        if (issuer != APPLE_ISSUER || audienceClientId !in audiences) {
            throw BusinessException(ErrorCode.INVALID_CREDENTIALS)
        }

        return VerifiedAppleIdentity(
            sub = claims.subject ?: throw BusinessException(ErrorCode.INVALID_CREDENTIALS),
            email = claims.getStringClaim("email"),
            // Native Sign in with Apple does not include display name in the id token.
            name = null,
        )
    }

    private companion object {
        const val APPLE_ISSUER = "https://appleid.apple.com"
        const val APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys"
    }
}
