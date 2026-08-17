package com.japanese.vocabulary.deck

import com.japanese.vocabulary.deck.event.DeckEventListener
import com.japanese.vocabulary.deck.repository.DeckRepository
import com.japanese.vocabulary.deck.repository.DeckWordRepository
import com.japanese.vocabulary.test.ApiAfterCommitListenerTest
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.test.fixtures.TestWordBuilder
import com.japanese.vocabulary.word.event.WordDeletedEvent
import com.japanese.vocabulary.word.event.WordSavedEvent
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Direct-call listener test. Listener carries @Transactional(REQUIRES_NEW), so setup must
 * be committed beforehand via inTx { ... } — otherwise the listener's separate connection
 * cannot see the uncommitted entities. See AfterCommitListenerTest for the full rationale.
 */
class DeckEventListenerTest : ApiAfterCommitListenerTest() {

    @Autowired private lateinit var listener: DeckEventListener
    @Autowired private lateinit var deckRepository: DeckRepository
    @Autowired private lateinit var deckWordRepository: DeckWordRepository

    @Test
    fun `onWordSaved links the word to both the default deck and a new song deck`() {
        val (me, song, word) = inTx {
            val u = TestUserBuilder(entityManager).build()
            val s = TestSongBuilder(entityManager).build()
            val w = TestWordBuilder(entityManager).forUser(u).build()
            Triple(u, s, w)
        }

        listener.onWordSaved(WordSavedEvent(userId = me.id!!, wordId = word.id!!, songId = song.id!!))

        val songDeck = deckRepository.findByUserIdAndSongId(me.id!!, song.id!!)!!
        assertThat(songDeck.title).isEqualTo(song.title)
        assertThat(songDeck.description).isEqualTo(song.artist)
        assertThat(songDeck.isDefault).isNull()
        assertThat(deckWordRepository.existsByDeckIdAndWordId(songDeck.id!!, word.id!!)).isTrue

        val defaultDeck = deckRepository.findByUserIdAndIsDefaultTrue(me.id!!)!!
        assertThat(defaultDeck.songId).isNull()
        assertThat(deckWordRepository.existsByDeckIdAndWordId(defaultDeck.id!!, word.id!!)).isTrue
    }

    @Test
    fun `onWordSaved without a songId only links the default deck`() {
        val (me, word) = inTx {
            val u = TestUserBuilder(entityManager).build()
            val w = TestWordBuilder(entityManager).forUser(u).build()
            u to w
        }

        listener.onWordSaved(WordSavedEvent(userId = me.id!!, wordId = word.id!!, songId = null))

        val decks = deckRepository.findByUserIdOrderByCreatedAtDesc(
            me.id!!,
            org.springframework.data.domain.PageRequest.of(0, 10),
        )
        assertThat(decks).hasSize(1)
        assertThat(decks.single().isDefault).isTrue
    }

    @Test
    fun `onWordSaved reuses an existing deck for the same user-song pair`() {
        data class Setup(val userId: Long, val songId: Long, val word1Id: Long, val word2Id: Long)
        val s = inTx {
            val u = TestUserBuilder(entityManager).build()
            val song = TestSongBuilder(entityManager).build()
            val w1 = TestWordBuilder(entityManager).forUser(u).build()
            val w2 = TestWordBuilder(entityManager).forUser(u).build()
            Setup(u.id!!, song.id!!, w1.id!!, w2.id!!)
        }

        listener.onWordSaved(WordSavedEvent(s.userId, s.word1Id, s.songId))
        listener.onWordSaved(WordSavedEvent(s.userId, s.word2Id, s.songId))

        val songDeck = deckRepository.findByUserIdAndSongId(s.userId, s.songId)!!
        assertThat(deckWordRepository.findByDeckId(songDeck.id!!).map { it.wordId })
            .containsExactlyInAnyOrder(s.word1Id, s.word2Id)

        val defaultDeck = deckRepository.findByUserIdAndIsDefaultTrue(s.userId)!!
        assertThat(deckWordRepository.findByDeckId(defaultDeck.id!!).map { it.wordId })
            .containsExactlyInAnyOrder(s.word1Id, s.word2Id)
    }

    @Test
    fun `onWordSaved is idempotent for the same word`() {
        val (me, song, word) = inTx {
            val u = TestUserBuilder(entityManager).build()
            val s = TestSongBuilder(entityManager).build()
            val w = TestWordBuilder(entityManager).forUser(u).build()
            Triple(u, s, w)
        }
        val event = WordSavedEvent(me.id!!, word.id!!, song.id!!)

        listener.onWordSaved(event)
        listener.onWordSaved(event)

        val songDeck = deckRepository.findByUserIdAndSongId(me.id!!, song.id!!)!!
        assertThat(deckWordRepository.findByDeckId(songDeck.id!!)).hasSize(1)
    }

    /**
     * deck_word 는 deck 구성의 유일한 기록이라, 곡 단어장 연결이 실패했다고 전체 단어장 연결까지
     * 되돌아가면 단어가 어느 단어장에도 없는 채로 영구히 남는다 (사용자가 다시 담아 복구할 수도 없다).
     * 두 연결이 서로 다른 트랜잭션이어야 한다는 뜻.
     */
    @Test
    fun `default deck link survives when the song deck link fails`() {
        val (me, word) = inTx {
            val u = TestUserBuilder(entityManager).build()
            val w = TestWordBuilder(entityManager).forUser(u).build()
            u to w
        }

        assertThatThrownBy {
            listener.onWordSaved(WordSavedEvent(userId = me.id!!, wordId = word.id!!, songId = 999_999L))
        }.isInstanceOf(IllegalStateException::class.java)

        val defaultDeck = deckRepository.findByUserIdAndIsDefaultTrue(me.id!!)
        assertThat(defaultDeck).isNotNull
        assertThat(deckWordRepository.existsByDeckIdAndWordId(defaultDeck!!.id!!, word.id!!)).isTrue
    }

    /** 같은 유저·같은 곡으로 동시에 담아도 deck UNIQUE 충돌에 지지 않고 둘 다 연결되어야 한다. */
    @Test
    fun `concurrent saves for the same user and song both end up linked`() {
        data class Setup(val userId: Long, val songId: Long, val wordIds: List<Long>)
        val s = inTx {
            val u = TestUserBuilder(entityManager).build()
            val song = TestSongBuilder(entityManager).build()
            val words = (1..4).map { TestWordBuilder(entityManager).forUser(u).build().id!! }
            Setup(u.id!!, song.id!!, words)
        }

        val pool = Executors.newFixedThreadPool(s.wordIds.size)
        val start = CountDownLatch(1)
        try {
            val futures = s.wordIds.map { wordId ->
                pool.submit {
                    start.await()
                    listener.onWordSaved(WordSavedEvent(s.userId, wordId, s.songId))
                }
            }
            start.countDown()
            futures.forEach { it.get(30, TimeUnit.SECONDS) }
        } finally {
            pool.shutdownNow()
        }

        val songDeck = deckRepository.findByUserIdAndSongId(s.userId, s.songId)!!
        assertThat(deckWordRepository.findByDeckId(songDeck.id!!).map { it.wordId })
            .containsExactlyInAnyOrderElementsOf(s.wordIds)

        val defaultDeck = deckRepository.findByUserIdAndIsDefaultTrue(s.userId)!!
        assertThat(deckWordRepository.findByDeckId(defaultDeck.id!!).map { it.wordId })
            .containsExactlyInAnyOrderElementsOf(s.wordIds)
    }

    @Test
    fun `onWordDeleted removes every deck link for the word`() {
        val (me, song, word) = inTx {
            val u = TestUserBuilder(entityManager).build()
            val s = TestSongBuilder(entityManager).build()
            val w = TestWordBuilder(entityManager).forUser(u).build()
            Triple(u, s, w)
        }
        listener.onWordSaved(WordSavedEvent(me.id!!, word.id!!, song.id!!))
        val songDeck = deckRepository.findByUserIdAndSongId(me.id!!, song.id!!)!!
        val defaultDeck = deckRepository.findByUserIdAndIsDefaultTrue(me.id!!)!!

        inTx { listener.onWordDeleted(WordDeletedEvent(wordId = word.id!!)) }

        assertThat(deckWordRepository.existsByDeckIdAndWordId(songDeck.id!!, word.id!!)).isFalse
        assertThat(deckWordRepository.existsByDeckIdAndWordId(defaultDeck.id!!, word.id!!)).isFalse
    }
}
