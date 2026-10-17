package com.japanese.vocabulary.rewardcard.service

import com.japanese.vocabulary.rewardcard.config.ShareProperties
import com.japanese.vocabulary.rewardcard.model.RewardCardKind
import io.jsonwebtoken.JwtException
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.Locator
import io.jsonwebtoken.ProtectedHeader
import io.jsonwebtoken.security.Keys
import org.springframework.stereotype.Component
import javax.crypto.SecretKey

data class ShareTokenClaims(
    val kind: RewardCardKind,
    val cardId: Long,
)

/**
 * 공유 링크 토큰. 카드 종류·id 를 서명한 JWT 이고, 만료·발급 시각을 넣지 않아 같은 카드는 늘 같은 토큰이다.
 * 서명 키를 버리면 이미 올라간 링크가 전부 깨지므로 키를 바꿀 땐 옛 키를 검증용으로 남긴다.
 */
@Component
class RewardCardShareTokens(shareProperties: ShareProperties) {
    private val keys: Map<String, SecretKey> = shareProperties.tokenKeys.associate { (kid, secret) ->
        kid to Keys.hmacShaKeyFor(secret.toByteArray())
    }
    private val signingKid = shareProperties.tokenKeys.first().first

    private val parser = Jwts.parser()
        .keyLocator(Locator { header -> keys[(header as? ProtectedHeader)?.keyId] ?: throw JwtException("unknown kid") })
        .build()

    fun issue(kind: RewardCardKind, cardId: Long): String = Jwts.builder()
        .header().keyId(signingKid).and()
        .claim(KIND, KIND_CODES.getValue(kind))
        .claim(CARD, cardId)
        .signWith(keys.getValue(signingKid), Jwts.SIG.HS256)
        .compact()

    fun parse(token: String): ShareTokenClaims? {
        if (token.length > MAX_TOKEN_LENGTH) return null
        val claims = try {
            parser.parseSignedClaims(token).payload
        } catch (e: JwtException) {
            return null
        } catch (e: IllegalArgumentException) {
            return null
        }
        val kind = KIND_CODES.entries.firstOrNull { it.value == claims[KIND] }?.key ?: return null
        val cardId = (claims[CARD] as? Number)?.toLong() ?: return null
        return ShareTokenClaims(kind, cardId)
    }

    /** 미리보기 이미지 키. 서명은 서버 키 없이 만들 수 없어 카드 id 를 알아도 남의 미리보기 주소를 짐작할 수 없다. */
    fun imageKey(token: String): String = "shares/${token.substringAfterLast('.')}.png"

    companion object {
        private const val KIND = "k"
        private const val CARD = "c"
        private const val MAX_TOKEN_LENGTH = 512
        private val KIND_CODES = mapOf(RewardCardKind.SONG to "s", RewardCardKind.ARTIST to "a")
    }
}
