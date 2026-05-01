package com.japanese.vocabulary.user.entity

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(
    name = "users",
    uniqueConstraints = [
        UniqueConstraint(name = "uk_user_provider", columnNames = ["provider", "provider_sub"])
    ]
)
class UserEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false, length = 32)
    val provider: String,

    @Column(name = "provider_sub", nullable = false, length = 255)
    val providerSub: String,

    @Column(nullable = true, length = 255)
    val email: String? = null,

    @Column(nullable = false, length = 100)
    val name: String,

    @Column(name = "created_at")
    val createdAt: Instant = Instant.now()
)
