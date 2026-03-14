package com.japanese.vocabulary.word.entity

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(
    name = "words",
    uniqueConstraints = [UniqueConstraint(columnNames = ["user_id", "japanese_text"])]
)
class WordEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(name = "japanese_text", nullable = false, length = 255)
    val japaneseText: String,

    @Column(length = 255)
    val reading: String? = null,

    @Column(name = "korean_text", length = 500)
    val koreanText: String? = null,

    @Column(name = "created_at")
    val createdAt: Instant = Instant.now()
)
