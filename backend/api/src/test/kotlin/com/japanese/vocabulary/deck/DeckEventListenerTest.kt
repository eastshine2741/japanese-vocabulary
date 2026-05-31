package com.japanese.vocabulary.deck

import com.japanese.vocabulary.deck.event.DeckEventListener
import com.japanese.vocabulary.deck.repository.DeckFlashcardRepository
import com.japanese.vocabulary.deck.repository.DeckRepository
import com.japanese.vocabulary.flashcard.event.FlashcardDeletedEvent
import com.japanese.vocabulary.test.ApiBaseIntegrationTest
import com.japanese.vocabulary.test.fixtures.TestFlashcardBuilder
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.word.event.SongWordCreatedEvent
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired

/**
 * Listener-level integration test. Under outer @Transactional rollback,
 * @TransactionalEventListener(AFTER_COMMIT) hooks never fire, so the listener
 * is invoked directly here. Persistence still goes through the real
 * Testcontainers MySQL — only the event-dispatch boundary is bypassed.
 */
class DeckEventListenerTest : ApiBaseIntegrationTest() {

    @Autowired private lateinit var listener: DeckEventListener
    @Autowired private lateinit var deckRepository: DeckRepository
    @Autowired private lateinit var deckFlashcardRepository: DeckFlashcardRepository

    @Test
    fun `onSongWordCreated creates a new deck and links the flashcard`() {
        val me = TestUserBuilder(entityManager).build()
        val song = TestSongBuilder(entityManager).build()
        val card = TestFlashcardBuilder(entityManager, clock).forUser(me).build()

        listener.onSongWordCreated(
            SongWordCreatedEvent(
                userId = me.id!!,
                songId = song.id!!,
                wordId = card.wordId,
                flashcardId = card.id!!,
            ),
        )

        entityManager.flush(); entityManager.clear()
        val deck = deckRepository.findByUserIdAndSongId(me.id!!, song.id!!)!!
        assertThat(deck.title).isEqualTo(song.title)
        assertThat(deck.description).isEqualTo(song.artist)
        assertThat(deckFlashcardRepository.existsByDeckIdAndFlashcardId(deck.id!!, card.id!!)).isTrue
    }

    @Test
    fun `onSongWordCreated reuses an existing deck for the same user-song pair`() {
        val me = TestUserBuilder(entityManager).build()
        val song = TestSongBuilder(entityManager).build()
        val card1 = TestFlashcardBuilder(entityManager, clock).forUser(me).build()
        val card2 = TestFlashcardBuilder(entityManager, clock).forUser(me).build()

        listener.onSongWordCreated(SongWordCreatedEvent(me.id!!, song.id!!, card1.wordId, card1.id!!))
        listener.onSongWordCreated(SongWordCreatedEvent(me.id!!, song.id!!, card2.wordId, card2.id!!))

        entityManager.flush(); entityManager.clear()
        val decks = deckRepository.findByUserIdOrderByCreatedAtDesc(
            me.id!!,
            org.springframework.data.domain.PageRequest.of(0, 10),
        )
        assertThat(decks).hasSize(1)
        val deckId = decks.single().id!!
        assertThat(deckFlashcardRepository.findByDeckId(deckId).map { it.flashcardId })
            .containsExactlyInAnyOrder(card1.id, card2.id)
    }

    @Test
    fun `onSongWordCreated is idempotent for the same flashcard`() {
        val me = TestUserBuilder(entityManager).build()
        val song = TestSongBuilder(entityManager).build()
        val card = TestFlashcardBuilder(entityManager, clock).forUser(me).build()
        val event = SongWordCreatedEvent(me.id!!, song.id!!, card.wordId, card.id!!)

        listener.onSongWordCreated(event)
        listener.onSongWordCreated(event)

        entityManager.flush(); entityManager.clear()
        val deck = deckRepository.findByUserIdAndSongId(me.id!!, song.id!!)!!
        assertThat(deckFlashcardRepository.findByDeckId(deck.id!!)).hasSize(1)
    }

    @Test
    fun `onFlashcardDeleted removes the DeckFlashcard link`() {
        val me = TestUserBuilder(entityManager).build()
        val song = TestSongBuilder(entityManager).build()
        val card = TestFlashcardBuilder(entityManager, clock).forUser(me).build()
        listener.onSongWordCreated(SongWordCreatedEvent(me.id!!, song.id!!, card.wordId, card.id!!))
        val deck = deckRepository.findByUserIdAndSongId(me.id!!, song.id!!)!!
        assertThat(deckFlashcardRepository.existsByDeckIdAndFlashcardId(deck.id!!, card.id!!)).isTrue

        listener.onFlashcardDeleted(FlashcardDeletedEvent(flashcardId = card.id!!))

        entityManager.flush(); entityManager.clear()
        assertThat(deckFlashcardRepository.existsByDeckIdAndFlashcardId(deck.id!!, card.id!!)).isFalse
    }
}
