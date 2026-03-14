package com.japanese.vocabulary.user.service

import com.japanese.vocabulary.user.dto.UserSettingsDTO
import com.japanese.vocabulary.user.entity.UserSettingsEntity
import com.japanese.vocabulary.user.repository.UserSettingsRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class UserSettingsService(
    private val userSettingsRepository: UserSettingsRepository
) {
    @Transactional(readOnly = true)
    fun getSettings(userId: Long): UserSettingsDTO {
        val settings = userSettingsRepository.findByUserId(userId)
            ?: return UserSettingsDTO(requestRetention = 0.9, showIntervals = true)
        return UserSettingsDTO(requestRetention = settings.requestRetention, showIntervals = settings.showIntervals)
    }

    @Transactional
    fun updateSettings(userId: Long, dto: UserSettingsDTO): UserSettingsDTO {
        require(dto.requestRetention in 0.7..0.99) { "requestRetention must be between 0.7 and 0.99" }
        val settings = userSettingsRepository.findByUserId(userId)
            ?: UserSettingsEntity(userId = userId)
        settings.requestRetention = dto.requestRetention
        settings.showIntervals = dto.showIntervals
        userSettingsRepository.save(settings)
        return UserSettingsDTO(requestRetention = settings.requestRetention, showIntervals = settings.showIntervals)
    }
}
