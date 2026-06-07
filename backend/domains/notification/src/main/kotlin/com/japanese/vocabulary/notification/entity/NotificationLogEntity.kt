package com.japanese.vocabulary.notification.entity

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "notification_logs")
class NotificationLogEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(name = "sent_at", nullable = false)
    val sentAt: Instant,

    @Column(nullable = false, length = 255)
    val title: String,

    @Column(nullable = false, length = 512)
    val body: String,
)
