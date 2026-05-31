package com.japanese.vocabulary.user.entity

import jakarta.persistence.*
import org.springframework.data.annotation.CreatedDate
import org.springframework.data.jpa.domain.support.AuditingEntityListener
import java.time.Instant

@Entity
@Table(
    name = "users",
    uniqueConstraints = [
        UniqueConstraint(name = "uk_user_provider", columnNames = ["provider", "provider_sub"]),
        UniqueConstraint(name = "uk_user_username", columnNames = ["username"])
    ]
)
@EntityListeners(AuditingEntityListener::class)
class UserEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false, length = 32)
    val provider: String,

    @Column(name = "provider_sub", nullable = false, length = 255)
    var providerSub: String,

    @Column(nullable = false, length = 63)
    var username: String,

    @Column(nullable = true, length = 255)
    var email: String? = null,

    @Column(nullable = true, length = 100)
    var name: String? = null,

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    var createdAt: Instant? = null,

    @Column(name = "deleted_at")
    var deletedAt: Instant? = null,
)
