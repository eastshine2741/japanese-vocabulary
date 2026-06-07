package com.japanese.vocabulary.user.entity

import jakarta.persistence.*
import org.springframework.data.annotation.CreatedDate
import org.springframework.data.annotation.LastModifiedDate
import org.springframework.data.jpa.domain.support.AuditingEntityListener
import java.time.Instant

enum class Platform { IOS, ANDROID }

@Entity
@Table(
    name = "device_tokens",
    uniqueConstraints = [UniqueConstraint(name = "uk_device_tokens_token", columnNames = ["token"])],
    indexes = [Index(name = "idx_device_tokens_user", columnList = "user_id")]
)
@EntityListeners(AuditingEntityListener::class)
class DeviceTokenEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "user_id", nullable = false)
    var userId: Long,

    @Column(nullable = false, length = 512, unique = true)
    val token: String,

    @Column(nullable = false, length = 16)
    var platform: String,

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    var createdAt: Instant? = null,

    @LastModifiedDate
    @Column(name = "updated_at")
    var updatedAt: Instant? = null,
)
