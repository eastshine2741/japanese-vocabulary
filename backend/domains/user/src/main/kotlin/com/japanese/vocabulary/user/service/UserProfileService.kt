package com.japanese.vocabulary.user.service

import org.springframework.stereotype.Service
import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.user.dto.UserDto
import com.japanese.vocabulary.user.dto.toDto
import com.japanese.vocabulary.user.repository.UserRepository
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class UserProfileService(
    private val userRepository: UserRepository,
) {
    @Transactional(readOnly = true)
    fun getProfile(userId: Long): UserDto =
        userRepository.findByIdAndDeletedAtIsNull(userId)?.toDto()
            ?: throw BusinessException(ErrorCode.INVALID_CREDENTIALS)

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

    /** Returns the key it replaced so the caller can drop that object once this commits. */
    @Transactional
    fun replaceProfileImageKey(userId: Long, key: String?): String? {
        val user = userRepository.findByIdAndDeletedAtIsNull(userId)
            ?: throw BusinessException(ErrorCode.INVALID_CREDENTIALS)
        val previous = user.profileImageKey
        user.profileImageKey = key
        userRepository.save(user)
        return previous
    }

    /**
     * Soft delete. provider_sub and username are mutated so the same identity can sign up again;
     * email, display name and profile image are cleared to minimize PII; the returned image key is
     * the caller's to delete from storage. Child rows stay, unreachable because
     * every read path resolves users via findByIdAndDeletedAtIsNull.
     */
    @Transactional
    fun deleteSelf(userId: Long): String? {
        val user = userRepository.findByIdAndDeletedAtIsNull(userId)
            ?: throw BusinessException(ErrorCode.INVALID_CREDENTIALS)
        val id = user.id ?: throw IllegalStateException("Persisted user is missing an id")
        user.deletedAt = Instant.now()
        user.providerSub = "deleted:$id:${user.providerSub}"
        user.username = "deleted:$id:${user.username}"
        user.email = null
        user.name = null
        val profileImageKey = user.profileImageKey
        user.profileImageKey = null
        userRepository.save(user)
        return profileImageKey
    }
}
