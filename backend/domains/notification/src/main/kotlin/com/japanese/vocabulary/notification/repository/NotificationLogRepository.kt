package com.japanese.vocabulary.notification.repository

import com.japanese.vocabulary.notification.entity.NotificationLogEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface NotificationLogRepository : JpaRepository<NotificationLogEntity, Long>
