package com.japanese.vocabulary.entity

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "users")
class UserEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false, unique = true, length = 100)
    val name: String,

    @Column(nullable = false, length = 255)
    val password: String,

    @Column(name = "created_at")
    val createdAt: Instant = Instant.now()
)
