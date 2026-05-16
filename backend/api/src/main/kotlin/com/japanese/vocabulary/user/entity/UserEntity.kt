package com.japanese.vocabulary.user.entity

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(
    name = "users",
    uniqueConstraints = [
        UniqueConstraint(name = "uk_user_provider", columnNames = ["provider", "provider_sub"]),
        UniqueConstraint(name = "uk_user_username", columnNames = ["username"])
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

    @Column(nullable = false, length = 20)
    var username: String,

    @Column(nullable = true, length = 255)
    var email: String? = null,

    @Column(nullable = true, length = 100)
    var name: String? = null,

    @Column(name = "created_at")
    val createdAt: Instant = Instant.now()
)
