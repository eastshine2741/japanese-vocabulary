package com.japanese.vocabulary.deck.entity

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(name = "decks")
class DeckEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(name = "song_id", nullable = false)
    val songId: Long,

    @Column(name = "created_at")
    val createdAt: Instant = Instant.now()
)
