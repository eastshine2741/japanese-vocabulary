package com.japanese.vocabulary.songsearch.client.applemusic

import com.fasterxml.jackson.databind.ObjectMapper
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset
import java.util.Base64

class AppleMusicTokenProviderTest {

    private val keyPair: KeyPair = KeyPairGenerator.getInstance("EC")
        .apply { initialize(ECGenParameterSpec("secp256r1")) }
        .generateKeyPair()

    @Test
    fun `token is an ES256 JWT that the key's public half verifies`() {
        val now = Instant.parse("2026-10-09T00:00:00Z")
        val token = provider(MutableClock(now)).token()

        val (header, payload, signature) = token.split(".")
        val json = ObjectMapper()
        assertThat(json.readTree(decode(header)).let { it["alg"].asText() to it["kid"].asText() })
            .isEqualTo("ES256" to "KEYID12345")
        val claims = json.readTree(decode(payload))
        assertThat(claims["iss"].asText()).isEqualTo("TEAMID1234")
        assertThat(claims["iat"].asLong()).isEqualTo(now.epochSecond)
        assertThat(claims["exp"].asLong()).isGreaterThan(now.epochSecond)
        val verified = Signature.getInstance("SHA256withECDSAinP1363Format").run {
            initVerify(keyPair.public)
            update("$header.$payload".toByteArray())
            verify(Base64.getUrlDecoder().decode(signature))
        }
        assertThat(verified).isTrue()
    }

    @Test
    fun `token is reused until close to expiry, then re-signed`() {
        val clock = MutableClock(Instant.parse("2026-10-09T00:00:00Z"))
        val provider = provider(clock)
        val first = provider.token()

        clock.advance(Duration.ofHours(1))
        assertThat(provider.token()).isEqualTo(first)

        clock.advance(Duration.ofHours(11))
        assertThat(provider.token()).isNotEqualTo(first)
    }

    @Test
    fun `blank settings fail at the first call instead of at boot`() {
        val provider = AppleMusicTokenProvider("", "", "")

        assertThatThrownBy { provider.token() }.isInstanceOf(IllegalStateException::class.java)
    }

    private fun provider(clock: Clock): AppleMusicTokenProvider {
        val pem = "-----BEGIN PRIVATE KEY-----\n" +
            Base64.getMimeEncoder(64, "\n".toByteArray()).encodeToString(keyPair.private.encoded) +
            "\n-----END PRIVATE KEY-----\n"
        return AppleMusicTokenProvider(
            teamId = "TEAMID1234",
            keyId = "KEYID12345",
            privateKeyBase64 = Base64.getEncoder().encodeToString(pem.toByteArray()),
            clock = clock,
        )
    }

    private fun decode(part: String) = String(Base64.getUrlDecoder().decode(part))

    private class MutableClock(private var now: Instant) : Clock() {
        fun advance(duration: Duration) { now = now.plus(duration) }
        override fun instant(): Instant = now
        override fun getZone() = ZoneOffset.UTC
        override fun withZone(zone: java.time.ZoneId?) = this
    }
}
