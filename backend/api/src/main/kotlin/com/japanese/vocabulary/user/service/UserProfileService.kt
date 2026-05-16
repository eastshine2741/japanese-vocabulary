package com.japanese.vocabulary.user.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.user.dto.UserProfileResponse
import com.japanese.vocabulary.user.repository.UserRepository
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

    fun updateName(userId: Long, rawName: String?): UserProfileResponse {
        val user = userRepository.findById(userId).orElseThrow {
            BusinessException(ErrorCode.INVALID_CREDENTIALS)
        }
        user.name = rawName?.trim()?.takeIf { it.isNotEmpty() }
        val saved = userRepository.save(user)
        return UserProfileResponse(username = saved.username, name = saved.name)
    }
}
