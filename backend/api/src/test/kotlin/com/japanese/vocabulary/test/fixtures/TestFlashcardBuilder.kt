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

    fun forUser(value: UserEntity) = apply { user = value }
    fun ofWord(value: WordEntity) = apply { word = value }

    fun build(): FlashcardEntity {
        val owner = user ?: TestUserBuilder(em).build()
        val targetWord = word ?: TestWordBuilder(em).forUser(owner).build()
        return FlashcardEntity(
            wordId = targetWord.id!!,
            userId = owner.id!!,
            due = Instant.now(clock),
        ).also {
            em.persist(it)
            em.flush()
        }
    }
}
