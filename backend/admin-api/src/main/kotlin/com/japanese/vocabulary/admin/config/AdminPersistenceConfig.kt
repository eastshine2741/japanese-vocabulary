package com.japanese.vocabulary.admin.config

import com.japanese.vocabulary.admin.repository.AdminSongRepository
import org.springframework.context.annotation.Configuration
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@Configuration
@EnableJpaRepositories(basePackageClasses = [AdminSongRepository::class])
class AdminPersistenceConfig
