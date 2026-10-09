package com.japanese.vocabulary.songsearch.client.applemusic

import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.security.KeyFactory
import java.security.PrivateKey
import java.security.Signature
import java.security.spec.PKCS8EncodedKeySpec
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.Base64

/**
 * Signs the Apple Music developer token (ES256 JWT) from the MusicKit key. Blank settings leave the
 * bean bootable so tests and local runs without the key start; the first call then fails loudly.
 */
@Component
class AppleMusicTokenProvider(
    @Value("\${apple-music.team-id:}") private val teamId: String,
    @Value("\${apple-music.key-id:}") private val keyId: String,
    @Value("\${apple-music.private-key-base64:}") private val privateKeyBase64: String,
    private val clock: Clock = Clock.systemUTC(),
) {
    private val privateKey: PrivateKey? by lazy { parsePrivateKey() }

    @Volatile
    private var cached: Pair<String, Instant>? = null

    fun token(): String {
        val now = clock.instant()
        cached?.let { (token, expiresAt) -> if (now.isBefore(expiresAt.minus(REFRESH_MARGIN))) return token }
        return synchronized(this) {
            cached?.takeIf { now.isBefore(it.second.minus(REFRESH_MARGIN)) }?.first
                ?: sign(now).also { cached = it to now.plus(TOKEN_TTL) }
        }
    }

    private fun sign(now: Instant): String {
        val key = checkNotNull(privateKey) { "apple-music.team-id/key-id/private-key-base64 are not configured" }
        val header = """{"alg":"ES256","kid":"$keyId"}"""
        val payload = """{"iss":"$teamId","iat":${now.epochSecond},"exp":${now.plus(TOKEN_TTL).epochSecond}}"""
        val signingInput = "${base64Url(header.toByteArray())}.${base64Url(payload.toByteArray())}"
        // JWS wants the raw r||s pair, not the DER the plain SHA256withECDSA signature produces.
        val signature = Signature.getInstance("SHA256withECDSAinP1363Format").run {
            initSign(key)
            update(signingInput.toByteArray())
            sign()
        }
        return "$signingInput.${base64Url(signature)}"
    }

    private fun parsePrivateKey(): PrivateKey? {
        if (listOf(teamId, keyId, privateKeyBase64).any { it.isBlank() }) return null
        val pem = String(Base64.getDecoder().decode(privateKeyBase64.trim()))
        val der = Base64.getMimeDecoder().decode(
            pem.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "")
        )
        return KeyFactory.getInstance("EC").generatePrivate(PKCS8EncodedKeySpec(der))
    }

    private fun base64Url(bytes: ByteArray): String = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)

    companion object {
        private val TOKEN_TTL: Duration = Duration.ofHours(12)
        private val REFRESH_MARGIN: Duration = Duration.ofHours(1)
    }
}
