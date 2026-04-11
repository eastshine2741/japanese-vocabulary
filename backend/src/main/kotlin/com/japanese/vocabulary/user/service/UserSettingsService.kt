package com.japanese.vocabulary.user.service

import com.japanese.vocabulary.user.dto.UserSettingsDTO
import com.japanese.vocabulary.user.dto.UserSettingsData
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
        val data = userSettingsRepository.findByUserId(userId)?.settings ?: UserSettingsData()
        return UserSettingsDTO(requestRetention = data.requestRetention, showIntervals = data.showIntervals)
    }

    @Transactional
    fun updateSettings(userId: Long, dto: UserSettingsDTO): UserSettingsDTO {
        require(dto.requestRetention in 0.7..0.99) { "requestRetention must be between 0.7 and 0.99" }
        val entity = userSettingsRepository.findByUserId(userId)
            ?: UserSettingsEntity(userId = userId)
        entity.settings = UserSettingsData(
            requestRetention = dto.requestRetention,
            showIntervals = dto.showIntervals
        )
        userSettingsRepository.save(entity)
        return UserSettingsDTO(requestRetention = entity.settings.requestRetention, showIntervals = entity.settings.showIntervals)
    }
}
