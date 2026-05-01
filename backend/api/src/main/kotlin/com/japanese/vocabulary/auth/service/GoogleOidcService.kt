package com.japanese.vocabulary.auth.service

import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier
import com.google.api.client.http.javanet.NetHttpTransport
import com.google.api.client.json.gson.GsonFactory
import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service

data class VerifiedGoogleIdentity(
    val sub: String,
    val email: String?,
    val name: String?
)

@Service
class GoogleOidcService(
    @Value("\${google.oauth.client-id}") private val audienceClientId: String
) {
    private val verifier: GoogleIdTokenVerifier by lazy {
        GoogleIdTokenVerifier.Builder(NetHttpTransport(), GsonFactory.getDefaultInstance())
            .setAudience(listOf(audienceClientId))
            .build()
    }

    fun verify(idTokenString: String): VerifiedGoogleIdentity {
        val idToken = runCatching { verifier.verify(idTokenString) }
            .getOrNull()
            ?: throw BusinessException(ErrorCode.INVALID_CREDENTIALS)
        val payload = idToken.payload
        return VerifiedGoogleIdentity(
            sub = payload.subject,
            email = payload["email"] as? String,
            name = payload["name"] as? String
        )
    }
}
