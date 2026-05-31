package com.japanese.vocabulary.user.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.user.dto.UserSettingsDTO
import com.japanese.vocabulary.user.dto.UserSettingsData
import com.japanese.vocabulary.user.entity.UserSettingsEntity
import com.japanese.vocabulary.user.repository.UserSettingsRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class UserSettingsService(
    private val userSettingsRepository: UserSettingsRepository,
    private val objectMapper: ObjectMapper,
) {
    @Transactional(readOnly = true)
    fun getSettings(userId: Long): UserSettingsDTO {
        val data = userSettingsRepository.findByUserId(userId)?.settings ?: UserSettingsData()
        return data.toDto()
    }

    @Transactional
    fun updateSettings(userId: Long, dto: UserSettingsDTO): UserSettingsDTO {
        require(dto.readingDisplay in listOf("KATAKANA", "HIRAGANA", "KOREAN")) {
            "readingDisplay must be KATAKANA, HIRAGANA, or KOREAN"
        }
        require(dto.dailyGoal in 1..50000) { "dailyGoal must be between 1 and 50000" }
        val entity = userSettingsRepository.findByUserId(userId)
            ?: UserSettingsEntity(userId = userId)
        entity.settings = UserSettingsData(
            showIntervals = dto.showIntervals,
            readingDisplay = dto.readingDisplay,
            showKoreanPronunciation = dto.showKoreanPronunciation,
            showFurigana = dto.showFurigana,
            dailyGoal = dto.dailyGoal,
            notificationsEnabled = dto.notificationsEnabled,
        )
        userSettingsRepository.save(entity)
        return entity.settings.toDto()
    }

    /**
     * Returns the notifications-enabled flag for [userId]. Missing key (legacy rows that pre-date
     * the field) is treated as TRUE so existing users opt-in by default. Reads via raw JsonNode so
     * NOTIFICATIONS_ENABLED_KEY is the single source of truth shared with batch raw-SQL queries.
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

private fun UserSettingsData.toDto(): UserSettingsDTO = UserSettingsDTO(
    showIntervals = showIntervals,
    readingDisplay = readingDisplay,
    showKoreanPronunciation = showKoreanPronunciation,
    showFurigana = showFurigana,
    dailyGoal = dailyGoal,
    notificationsEnabled = notificationsEnabled,
)
