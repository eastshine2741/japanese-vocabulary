package com.japanese.autoconfigure.notification

import com.japanese.vocabulary.notification.config.FirebaseConfig
import com.japanese.vocabulary.notification.entity.DeviceTokenEntity
import com.japanese.vocabulary.notification.entity.NotificationLogEntity
import com.japanese.vocabulary.notification.repository.DeviceTokenRepository
import com.japanese.vocabulary.notification.repository.NotificationLogRepository
import com.japanese.vocabulary.notification.service.DeviceTokenService
import com.japanese.vocabulary.notification.service.PushNotificationService
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.Import
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@EntityScan(basePackageClasses = [DeviceTokenEntity::class, NotificationLogEntity::class])
@EnableJpaRepositories(basePackageClasses = [DeviceTokenRepository::class, NotificationLogRepository::class])
@Import(DeviceTokenService::class, PushNotificationService::class, FirebaseConfig::class)
class NotificationAutoConfiguration
