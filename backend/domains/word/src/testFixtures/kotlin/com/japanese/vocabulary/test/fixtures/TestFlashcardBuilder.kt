package com.japanese.vocabulary.test.fixtures

import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import com.japanese.vocabulary.user.entity.UserEntity
import com.japanese.vocabulary.word.entity.WordEntity
import jakarta.persistence.EntityManager
import java.time.Clock
import java.time.Instant

class TestFlashcardBuilder(
    private val em: EntityManager,
    private val clock: Clock,
) {
    private var user: UserEntity? = null
    private var word: WordEntity? = null
    private var due: Instant? = null
    private var state: Int = 0
    private var lastReview: Instant? = null

    fun forUser(value: UserEntity) = apply { user = value }
    fun ofWord(value: WordEntity) = apply { word = value }
    fun dueAt(value: Instant) = apply { due = value }
    fun withState(value: Int) = apply { state = value }
    fun lastReviewedAt(value: Instant?) = apply { lastReview = value }

    fun build(): FlashcardEntity {
        val owner = user ?: TestUserBuilder(em).build()
        val targetWord = word ?: TestWordBuilder(em).forUser(owner).build()
        return FlashcardEntity(
            wordId = targetWord.id!!,
            userId = owner.id!!,
            due = due ?: Instant.now(clock),
            state = state,
            lastReview = lastReview,
        ).also {
            em.persist(it)
            em.flush()
        }
    }
}
