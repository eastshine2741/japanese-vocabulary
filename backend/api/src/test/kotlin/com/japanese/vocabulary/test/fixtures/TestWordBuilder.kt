package com.japanese.vocabulary.test.fixtures

import com.japanese.vocabulary.user.entity.UserEntity
import com.japanese.vocabulary.word.dto.WordMeaning
import com.japanese.vocabulary.word.entity.WordEntity
import jakarta.persistence.EntityManager
import java.util.concurrent.atomic.AtomicLong

class TestWordBuilder(private val em: EntityManager) {
    private val seq = SEQ.incrementAndGet()
    private var user: UserEntity? = null
    private var japaneseText: String = "言葉$seq"
    private var reading: String? = "ことば"
    private var meanings: List<WordMeaning> = listOf(
        WordMeaning(text = "word", partOfSpeech = "noun"),
    )

    fun forUser(value: UserEntity) = apply { user = value }
    fun withJapaneseText(value: String) = apply { japaneseText = value }
    fun withReading(value: String?) = apply { reading = value }
    fun withMeanings(value: List<WordMeaning>) = apply { meanings = value }

    fun build(): WordEntity {
        val owner = user ?: TestUserBuilder(em).build()
        return WordEntity(
            userId = owner.id!!,
            japaneseText = japaneseText,
            reading = reading,
            meanings = meanings,
        ).also {
            em.persist(it)
            em.flush()
        }
    }

    companion object {
        private val SEQ = AtomicLong(0)
    }
}
