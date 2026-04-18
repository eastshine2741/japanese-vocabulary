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
        return UserSettingsDTO(
            requestRetention = data.requestRetention,
            showIntervals = data.showIntervals,
            readingDisplay = data.readingDisplay,
            showKoreanPronunciation = data.showKoreanPronunciation,
            showFurigana = data.showFurigana
        )
    }

    @Transactional
    fun updateSettings(userId: Long, dto: UserSettingsDTO): UserSettingsDTO {
        require(dto.requestRetention in 0.7..0.99) { "requestRetention must be between 0.7 and 0.99" }
        require(dto.readingDisplay in listOf("KATAKANA", "HIRAGANA", "KOREAN")) {
            "readingDisplay must be KATAKANA, HIRAGANA, or KOREAN"
        }
        val entity = userSettingsRepository.findByUserId(userId)
            ?: UserSettingsEntity(userId = userId)
        entity.settings = UserSettingsData(
            requestRetention = dto.requestRetention,
            showIntervals = dto.showIntervals,
            readingDisplay = dto.readingDisplay,
            showKoreanPronunciation = dto.showKoreanPronunciation,
            showFurigana = dto.showFurigana
        )
        userSettingsRepository.save(entity)
        return UserSettingsDTO(
            requestRetention = entity.settings.requestRetention,
            showIntervals = entity.settings.showIntervals,
            readingDisplay = entity.settings.readingDisplay,
            showKoreanPronunciation = entity.settings.showKoreanPronunciation,
            showFurigana = entity.settings.showFurigana
        )
    }
}
