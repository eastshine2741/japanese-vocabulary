package com.japanese.vocabulary.user.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.user.dto.UserDto
import com.japanese.vocabulary.user.dto.toDto
import com.japanese.vocabulary.user.repository.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class UserProfileService(
    private val userRepository: UserRepository,
) {
    @Transactional
    fun updateProfile(userId: Long, rawName: String?, rawUsername: String?): UserDto {
        val user = userRepository.findByIdAndDeletedAtIsNull(userId)
            ?: throw BusinessException(ErrorCode.INVALID_CREDENTIALS)

        if (rawUsername != null) {
            val normalized = UsernamePolicy.normalize(rawUsername)
            if (normalized != user.username) {
                UsernamePolicy.validate(normalized)
                userRepository.findByUsername(normalized)?.let {
                    if (it.id != user.id) throw BusinessException(ErrorCode.USERNAME_TAKEN)
                }
                user.username = normalized
            }
        }

        if (rawName != null) {
            user.name = rawName.trim().takeIf { it.isNotEmpty() }
        }

        return userRepository.save(user).toDto()
    }

    /**
     * Soft delete the user. Mutates provider_sub and username so the same Google
     * identity can sign up again as a fresh account. Email and display name are
     * cleared to minimize stored PII after deletion. Child rows (decks, words,
     * flashcards, etc.) are intentionally left intact; they become unreachable
     * because every read path resolves users via findByIdAndDeletedAtIsNull.
     */
    @Transactional
    fun deleteSelf(userId: Long) {
        val user = userRepository.findByIdAndDeletedAtIsNull(userId)
            ?: throw BusinessException(ErrorCode.INVALID_CREDENTIALS)
        val id = user.id ?: throw IllegalStateException("Persisted user is missing an id")
        user.deletedAt = Instant.now()
        user.providerSub = "deleted:$id:${user.providerSub}"
        user.username = "deleted:$id:${user.username}"
        user.email = null
        user.name = null
        userRepository.save(user)
    }
}
