package com.japanese.vocabulary.notification.repository

import com.japanese.vocabulary.notification.entity.NotificationLogEntity
import org.springframework.data.jpa.repository.JpaRepository

interface NotificationLogRepository : JpaRepository<NotificationLogEntity, Long>
