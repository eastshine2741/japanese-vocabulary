package com.japanese.autoconfigure.translation

import com.japanese.vocabulary.translation.entity.GeminiCallLogEntity
import com.japanese.vocabulary.translation.repository.GeminiCallLogRepository
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.ComponentScan
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@ComponentScan(basePackages = ["com.japanese.vocabulary.translation"])
@EntityScan(basePackageClasses = [GeminiCallLogEntity::class])
@EnableJpaRepositories(basePackageClasses = [GeminiCallLogRepository::class])
class TranslationAutoConfiguration
