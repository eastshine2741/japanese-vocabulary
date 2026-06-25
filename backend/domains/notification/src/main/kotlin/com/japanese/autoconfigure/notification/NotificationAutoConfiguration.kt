package com.japanese.autoconfigure.notification

import com.japanese.vocabulary.notification.entity.DeviceTokenEntity
import com.japanese.vocabulary.notification.entity.NotificationLogEntity
import com.japanese.vocabulary.notification.repository.DeviceTokenRepository
import com.japanese.vocabulary.notification.repository.NotificationLogRepository
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.ComponentScan
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@ComponentScan(basePackages = ["com.japanese.vocabulary.notification"])
@EntityScan(basePackageClasses = [DeviceTokenEntity::class, NotificationLogEntity::class])
@EnableJpaRepositories(basePackageClasses = [DeviceTokenRepository::class, NotificationLogRepository::class])
class NotificationAutoConfiguration
