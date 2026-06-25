package com.japanese.autoconfigure.user

import com.japanese.vocabulary.user.entity.UserEntity
import com.japanese.vocabulary.user.entity.UserSettingsEntity
import com.japanese.vocabulary.user.repository.UserRepository
import com.japanese.vocabulary.user.repository.UserSettingsRepository
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.ComponentScan
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@ComponentScan(basePackages = ["com.japanese.vocabulary.user"])
@EntityScan(basePackageClasses = [UserEntity::class, UserSettingsEntity::class])
@EnableJpaRepositories(basePackageClasses = [UserRepository::class, UserSettingsRepository::class])
class UserAutoConfiguration
