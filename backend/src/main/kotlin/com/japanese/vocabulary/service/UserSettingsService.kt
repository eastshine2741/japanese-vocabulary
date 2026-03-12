package com.japanese.vocabulary.service

import com.japanese.vocabulary.entity.UserSettingsEntity
import com.japanese.vocabulary.model.UserSettingsDTO
import com.japanese.vocabulary.repository.UserSettingsRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class UserSettingsService(
    private val userSettingsRepository: UserSettingsRepository
) {
    @Transactional(readOnly = true)
    fun getSettings(userId: Long): UserSettingsDTO {
        val settings = userSettingsRepository.findByUserId(userId)
            ?: return UserSettingsDTO(requestRetention = 0.9)
        return UserSettingsDTO(requestRetention = settings.requestRetention)
    }

    @Transactional
    fun updateSettings(userId: Long, dto: UserSettingsDTO): UserSettingsDTO {
        require(dto.requestRetention in 0.7..0.99) { "requestRetention must be between 0.7 and 0.99" }
        val settings = userSettingsRepository.findByUserId(userId)
            ?: UserSettingsEntity(userId = userId)
        settings.requestRetention = dto.requestRetention
        userSettingsRepository.save(settings)
        return UserSettingsDTO(requestRetention = settings.requestRetention)
    }
}
