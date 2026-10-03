package com.japanese.vocabulary.user.service

import org.springframework.stereotype.Service
import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.user.entity.UserSettingsEntity
import com.japanese.vocabulary.user.model.UserSettingsData
import com.japanese.vocabulary.user.repository.UserSettingsRepository
import org.springframework.transaction.annotation.Transactional

@Service
class UserSettingsService(
    private val userSettingsRepository: UserSettingsRepository,
    private val objectMapper: ObjectMapper,
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

    /**
     * A missing key (legacy rows) counts as TRUE. Reads via raw JsonNode so NOTIFICATIONS_ENABLED_KEY
     * stays the single source of truth shared with batch raw-SQL queries.
     */
    @Transactional(readOnly = true)
    fun getNotificationsEnabled(userId: Long): Boolean {
        val entity = userSettingsRepository.findByUserId(userId) ?: return true
        val jsonNode = objectMapper.valueToTree<com.fasterxml.jackson.databind.JsonNode>(entity.settings)
        return jsonNode.get(NOTIFICATIONS_ENABLED_KEY)?.asBoolean() ?: true
    }

    companion object {
        const val NOTIFICATIONS_ENABLED_KEY = "notificationsEnabled"
    }
}
