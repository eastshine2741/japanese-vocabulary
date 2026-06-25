package com.japanese.vocabulary.user.repository

import com.japanese.vocabulary.user.entity.UserSettingsEntity
import org.springframework.data.jpa.repository.JpaRepository

interface UserSettingsRepository : JpaRepository<UserSettingsEntity, Long> {
    fun findByUserId(userId: Long): UserSettingsEntity?
}
