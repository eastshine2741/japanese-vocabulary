package com.japanese.vocabulary.deck

import com.japanese.vocabulary.deck.event.DeckEventListener
import com.japanese.vocabulary.deck.repository.DeckFlashcardRepository
import com.japanese.vocabulary.deck.repository.DeckRepository
import com.japanese.vocabulary.flashcard.event.FlashcardDeletedEvent
import com.japanese.vocabulary.test.AfterCommitListenerTest
import com.japanese.vocabulary.test.fixtures.TestFlashcardBuilder
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.word.event.SongWordCreatedEvent
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired

/**
 * Direct-call listener test. Listener carries @Transactional(REQUIRES_NEW), so setup must
 * be committed beforehand via inTx { ... } — otherwise the listener's separate connection
 * cannot see the uncommitted entities. See AfterCommitListenerTest for the full rationale.
 */
class DeckEventListenerTest : AfterCommitListenerTest() {

    @Autowired private lateinit var listener: DeckEventListener
    @Autowired private lateinit var deckRepository: DeckRepository
    @Autowired private lateinit var deckFlashcardRepository: DeckFlashcardRepository

    @Test
    fun `onSongWordCreated creates a new deck and links the flashcard`() {
        val (me, song, card) = inTx {
            val u = TestUserBuilder(entityManager).build()
            val s = TestSongBuilder(entityManager).build()
            val c = TestFlashcardBuilder(entityManager, clock).forUser(u).build()
            Triple(u, s, c)
        }

        listener.onSongWordCreated(
            SongWordCreatedEvent(
                userId = me.id!!,
                songId = song.id!!,
                wordId = card.wordId,
                flashcardId = card.id!!,
            ),
        )

        val deck = deckRepository.findByUserIdAndSongId(me.id!!, song.id!!)!!
        assertThat(deck.title).isEqualTo(song.title)
        assertThat(deck.description).isEqualTo(song.artist)
        assertThat(deckFlashcardRepository.existsByDeckIdAndFlashcardId(deck.id!!, card.id!!)).isTrue
    }

    @Test
    fun `onSongWordCreated reuses an existing deck for the same user-song pair`() {
        data class Setup(
            val userId: Long,
            val songId: Long,
            val card1WordId: Long,
            val card1Id: Long,
            val card2WordId: Long,
            val card2Id: Long,
        )
        val s = inTx {
            val u = TestUserBuilder(entityManager).build()
            val song = TestSongBuilder(entityManager).build()
            val c1 = TestFlashcardBuilder(entityManager, clock).forUser(u).build()
            val c2 = TestFlashcardBuilder(entityManager, clock).forUser(u).build()
            Setup(u.id!!, song.id!!, c1.wordId, c1.id!!, c2.wordId, c2.id!!)
        }

        listener.onSongWordCreated(SongWordCreatedEvent(s.userId, s.songId, s.card1WordId, s.card1Id))
        listener.onSongWordCreated(SongWordCreatedEvent(s.userId, s.songId, s.card2WordId, s.card2Id))

        val decks = deckRepository.findByUserIdOrderByCreatedAtDesc(
            s.userId,
            org.springframework.data.domain.PageRequest.of(0, 10),
        )
        assertThat(decks).hasSize(1)
        val deckId = decks.single().id!!
        assertThat(deckFlashcardRepository.findByDeckId(deckId).map { it.flashcardId })
            .containsExactlyInAnyOrder(s.card1Id, s.card2Id)
    }

    @Test
    fun `onSongWordCreated is idempotent for the same flashcard`() {
        val (me, song, card) = inTx {
            val u = TestUserBuilder(entityManager).build()
            val s = TestSongBuilder(entityManager).build()
            val c = TestFlashcardBuilder(entityManager, clock).forUser(u).build()
            Triple(u, s, c)
        }
        val event = SongWordCreatedEvent(me.id!!, song.id!!, card.wordId, card.id!!)

        listener.onSongWordCreated(event)
        listener.onSongWordCreated(event)

        val deck = deckRepository.findByUserIdAndSongId(me.id!!, song.id!!)!!
        assertThat(deckFlashcardRepository.findByDeckId(deck.id!!)).hasSize(1)
    }

    @Test
    fun `onFlashcardDeleted removes the DeckFlashcard link`() {
        val (me, song, card) = inTx {
            val u = TestUserBuilder(entityManager).build()
            val s = TestSongBuilder(entityManager).build()
            val c = TestFlashcardBuilder(entityManager, clock).forUser(u).build()
            Triple(u, s, c)
        }
        listener.onSongWordCreated(SongWordCreatedEvent(me.id!!, song.id!!, card.wordId, card.id!!))
        val deck = deckRepository.findByUserIdAndSongId(me.id!!, song.id!!)!!
        assertThat(deckFlashcardRepository.existsByDeckIdAndFlashcardId(deck.id!!, card.id!!)).isTrue

        listener.onFlashcardDeleted(FlashcardDeletedEvent(flashcardId = card.id!!))

        assertThat(deckFlashcardRepository.existsByDeckIdAndFlashcardId(deck.id!!, card.id!!)).isFalse
    }
}
