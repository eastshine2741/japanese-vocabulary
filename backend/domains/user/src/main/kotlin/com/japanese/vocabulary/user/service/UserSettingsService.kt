package com.japanese.vocabulary.user.service

import org.springframework.stereotype.Service
import com.japanese.vocabulary.user.entity.UserSettingsEntity
import com.japanese.vocabulary.user.model.UserSettingsData
import com.japanese.vocabulary.user.repository.UserSettingsRepository
import org.springframework.transaction.annotation.Transactional

@Service
class UserSettingsService(
    private val userSettingsRepository: UserSettingsRepository,
) {
    @Transactional(readOnly = true)
    fun getSettings(userId: Long): UserSettingsData =
        userSettingsRepository.findByUserId(userId)?.settings ?: UserSettingsData()

    @Transactional
    fun updateSettings(userId: Long, data: UserSettingsData): UserSettingsData {
        require(data.readingDisplay in listOf("KATAKANA", "HIRAGANA", "KOREAN")) {
            "readingDisplay must be KATAKANA, HIRAGANA, or KOREAN"
        }
        require(data.dailyGoal in 1..50000) { "dailyGoal must be between 1 and 50000" }
        val entity = userSettingsRepository.findByUserId(userId)
            ?: UserSettingsEntity(userId = userId)
        entity.settings = data
        userSettingsRepository.save(entity)
        return entity.settings
    }
}
