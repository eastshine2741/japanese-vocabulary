package com.japanese.vocabulary.test.fixtures

import com.japanese.vocabulary.user.entity.UserEntity
import com.japanese.vocabulary.word.entity.WordEntity
import com.japanese.vocabulary.word.model.WordSense
import jakarta.persistence.EntityManager
import java.util.concurrent.atomic.AtomicLong

class TestWordBuilder(private val em: EntityManager) {
    private val seq = SEQ.incrementAndGet()
    private var user: UserEntity? = null
    private var japaneseText: String = "言葉$seq"
    private var reading: String? = "ことば"
    private var senses: List<WordSense> = listOf(
        WordSense(meaning = "word", partOfSpeech = "noun"),
    )

    fun forUser(value: UserEntity) = apply { user = value }
    fun withJapaneseText(value: String) = apply { japaneseText = value }
    fun withReading(value: String?) = apply { reading = value }
    fun withSenses(value: List<WordSense>) = apply { senses = value }

    fun build(): WordEntity {
        val owner = user ?: TestUserBuilder(em).build()
        return WordEntity(
            userId = owner.id!!,
            japaneseText = japaneseText,
            reading = reading,
            senses = senses,
        ).also {
            em.persist(it)
            em.flush()
        }
    }

    companion object {
        private val SEQ = AtomicLong(0)
    }
}
