package com.japanese.vocabulary.flashcard.entity

import jakarta.persistence.*
import org.springframework.data.annotation.CreatedDate
import org.springframework.data.jpa.domain.support.AuditingEntityListener
import java.time.Instant

@Entity
@Table(name = "flashcards")
@EntityListeners(AuditingEntityListener::class)
class FlashcardEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "word_id", nullable = false, unique = true)
    val wordId: Long,

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(nullable = false)
    var due: Instant,

    @Column(nullable = false)
    var stability: Double = 0.0,

    @Column(nullable = false)
    var difficulty: Double = 0.0,

    @Column(nullable = false)
    var state: Int = 0,

    @Column(name = "last_review")
    var lastReview: Instant? = null,

    @Column(name = "fsrs_card_json", nullable = false, columnDefinition = "JSON")
    var fsrsCardJson: String = "{}",

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    var createdAt: Instant? = null
) {
    fun reset(now: Instant) {
        state = 0
        stability = 0.0
        difficulty = 0.0
        due = now
        lastReview = null
        fsrsCardJson = "{}"
    }
}
