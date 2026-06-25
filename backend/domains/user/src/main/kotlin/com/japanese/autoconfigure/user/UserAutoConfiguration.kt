package com.japanese.autoconfigure.user

import com.japanese.vocabulary.user.entity.UserEntity
import com.japanese.vocabulary.user.entity.UserSettingsEntity
import com.japanese.vocabulary.user.repository.UserRepository
import com.japanese.vocabulary.user.repository.UserSettingsRepository
import com.japanese.vocabulary.user.service.UserProfileService
import com.japanese.vocabulary.user.service.UserSettingsService
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.Import
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@EntityScan(basePackageClasses = [UserEntity::class, UserSettingsEntity::class])
@EnableJpaRepositories(basePackageClasses = [UserRepository::class, UserSettingsRepository::class])
@Import(UserProfileService::class, UserSettingsService::class)
class UserAutoConfiguration
