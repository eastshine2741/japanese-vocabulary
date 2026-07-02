package com.japanese.autoconfigure.userinventory

import com.japanese.vocabulary.userinventory.entity.UserInventoryEntity
import com.japanese.vocabulary.userinventory.repository.UserInventoryRepository
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.ComponentScan
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@ComponentScan(basePackages = ["com.japanese.vocabulary.userinventory"])
@EntityScan(basePackageClasses = [UserInventoryEntity::class])
@EnableJpaRepositories(basePackageClasses = [UserInventoryRepository::class])
class UserInventoryAutoConfiguration
