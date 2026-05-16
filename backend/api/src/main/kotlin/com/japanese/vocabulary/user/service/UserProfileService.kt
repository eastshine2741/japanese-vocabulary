package com.japanese.vocabulary.user.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.user.dto.UserProfileResponse
import com.japanese.vocabulary.user.repository.UserRepository
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Service

@Service
class UserProfileService(
    private val userRepository: UserRepository,
) {
    fun getProfile(userId: Long): UserProfileResponse {
        val user = userRepository.findById(userId).orElseThrow {
            BusinessException(ErrorCode.INVALID_CREDENTIALS)
        }
        return UserProfileResponse(username = user.username, name = user.name)
    }

    fun updateProfile(userId: Long, rawName: String?, rawUsername: String?): UserProfileResponse {
        val user = userRepository.findById(userId).orElseThrow {
            BusinessException(ErrorCode.INVALID_CREDENTIALS)
        }

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

        return try {
            val saved = userRepository.save(user)
            UserProfileResponse(username = saved.username, name = saved.name)
        } catch (e: DataIntegrityViolationException) {
            // username uniqueness race
            throw BusinessException(ErrorCode.USERNAME_TAKEN)
        }
    }
}
