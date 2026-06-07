package com.japanese.vocabulary.user.service

import com.japanese.vocabulary.user.entity.Platform
import com.japanese.vocabulary.user.repository.DeviceTokenRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class DeviceTokenService(
    private val deviceTokenRepository: DeviceTokenRepository,
) {
    /**
     * Idempotent register: single-statement upsert keyed on `token` unique constraint.
     * On conflict the row is reassigned to [userId] (covers same-device re-login: user A → user B).
     */
    @Transactional
    fun register(userId: Long, token: String, platform: String) {
        require(token.isNotBlank()) { "token must not be blank" }
        require(token.length in MIN_TOKEN_LEN..MAX_TOKEN_LEN) {
            "token length must be in [$MIN_TOKEN_LEN, $MAX_TOKEN_LEN]"
        }
        require(TOKEN_REGEX.matches(token)) { "token format invalid" }
        val normalized = Platform.valueOf(platform.uppercase()).name
        if (deviceTokenRepository.findByToken(token)?.userId != userId &&
            deviceTokenRepository.countByUserId(userId) >= MAX_TOKENS_PER_USER
        ) {
            throw IllegalStateException("too many device tokens registered for user")
        }
        deviceTokenRepository.upsert(userId, token, normalized)
    }

    @Transactional
    fun unregister(token: String) {
        deviceTokenRepository.deleteByToken(token)
    }

    companion object {
        const val MAX_TOKENS_PER_USER = 50
        const val MIN_TOKEN_LEN = 8
        const val MAX_TOKEN_LEN = 512
        // Accepts FCM (base64url-ish), Expo (ExponentPushToken[...]) and dash/colon variants.
        // Strict enough to reject `<script>`-style garbage; permissive enough to track real tokens.
        private val TOKEN_REGEX = Regex("^[A-Za-z0-9_:./\\-\\[\\]]+$")
    }
}
