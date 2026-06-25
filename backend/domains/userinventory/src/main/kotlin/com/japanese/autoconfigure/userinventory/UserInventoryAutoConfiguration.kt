package com.japanese.autoconfigure.userinventory

import com.japanese.vocabulary.userinventory.entity.UserInventoryEntity
import com.japanese.vocabulary.userinventory.repository.UserInventoryRepository
import com.japanese.vocabulary.userinventory.service.UserInventoryService
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.Import
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@EntityScan(basePackageClasses = [UserInventoryEntity::class])
@EnableJpaRepositories(basePackageClasses = [UserInventoryRepository::class])
@Import(UserInventoryService::class)
class UserInventoryAutoConfiguration
