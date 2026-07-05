package com.japanese.vocabulary.word

import com.japanese.vocabulary.deck.entity.DeckEntity
import com.japanese.vocabulary.deck.entity.DeckFlashcardEntity
import com.japanese.vocabulary.deck.repository.DeckFlashcardRepository
import com.japanese.vocabulary.flashcard.repository.FlashcardRepository
import com.japanese.vocabulary.test.ApiAfterCommitListenerTest
import com.japanese.vocabulary.test.fixtures.TestFlashcardBuilder
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.test.fixtures.TestWordBuilder
import com.japanese.vocabulary.word.entity.SongWordEntity
import com.japanese.vocabulary.word.repository.SongWordRepository
import com.japanese.vocabulary.word.repository.WordRepository
import com.japanese.vocabulary.word.service.WordService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired

class WordDeletionDeckFlashcardTest : ApiAfterCommitListenerTest() {

    @Autowired private lateinit var wordService: WordService
    @Autowired private lateinit var wordRepository: WordRepository
    @Autowired private lateinit var songWordRepository: SongWordRepository
    @Autowired private lateinit var flashcardRepository: FlashcardRepository
    @Autowired private lateinit var deckFlashcardRepository: DeckFlashcardRepository

    @Test
    fun `deleteWord removes deck flashcard links before deleting flashcard`() {
        data class Setup(
            val userId: Long,
            val wordId: Long,
            val flashcardId: Long,
            val deckId: Long,
        )

        val setup = inTx {
            val user = TestUserBuilder(entityManager).build()
            val song = TestSongBuilder(entityManager).build()
            val word = TestWordBuilder(entityManager).forUser(user).build()
            entityManager.persist(
                SongWordEntity(
                    wordId = word.id!!,
                    songId = song.id!!,
                    lyricLine = "削除される言葉",
                ),
            )
            val flashcard = TestFlashcardBuilder(entityManager, clock).forUser(user).ofWord(word).build()
            val deck = DeckEntity(
                userId = user.id!!,
                songId = song.id!!,
                title = song.title,
                description = song.artist,
            )
            entityManager.persist(deck)
            entityManager.flush()
            entityManager.persist(DeckFlashcardEntity(deckId = deck.id!!, flashcardId = flashcard.id!!))
            entityManager.flush()

            Setup(
                userId = user.id!!,
                wordId = word.id!!,
                flashcardId = flashcard.id!!,
                deckId = deck.id!!,
            )
        }

        inTx {
            wordService.deleteWord(setup.userId, setup.wordId)
        }

        val remainingLinks = inTx {
            deckFlashcardRepository.findByDeckId(setup.deckId)
        }
        assertThat(remainingLinks).isEmpty()
        assertThat(flashcardRepository.findById(setup.flashcardId)).isEmpty
        assertThat(songWordRepository.findByWordId(setup.wordId)).isEmpty()
        assertThat(wordRepository.findById(setup.wordId)).isEmpty
    }
}
