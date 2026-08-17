package com.japanese.vocabulary.word

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.deck.repository.DeckRepository
import com.japanese.vocabulary.deck.repository.DeckWordRepository
import com.japanese.vocabulary.deck.service.DeckService
import com.japanese.vocabulary.flashcard.repository.FlashcardRepository
import com.japanese.vocabulary.test.ApiAfterCommitListenerTest
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.word.dto.AddWordDto
import com.japanese.vocabulary.word.dto.BatchAddWordDto
import com.japanese.vocabulary.word.model.WordSense
import com.japanese.vocabulary.word.repository.WordRepository
import com.japanese.vocabulary.word.service.WordService
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.domain.Pageable
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * word / flashcard / deck 수명주기 불변식 테스트.
 *
 * 테스트가 관리하는 트랜잭션을 쓰지 않는 부모를 상속한다 — 저장이 **한 트랜잭션 안에서**
 * 끝난다는 것과 실패 시 통째로 롤백된다는 것을 보려면 진짜 커밋 경계가 필요하고,
 * 동시성 테스트는 별도 커넥션에서 커밋된 데이터를 봐야 하기 때문이다.
 */
class WordLifecycleTest : ApiAfterCommitListenerTest() {

    @Autowired private lateinit var wordService: WordService
    @Autowired private lateinit var deckService: DeckService
    @Autowired private lateinit var wordRepository: WordRepository
    @Autowired private lateinit var flashcardRepository: FlashcardRepository
    @Autowired private lateinit var deckRepository: DeckRepository
    @Autowired private lateinit var deckWordRepository: DeckWordRepository

    private fun sense(meaning: String) = WordSense(meaning = meaning, partOfSpeech = "noun")

    private fun newUserId(): Long = inTx { TestUserBuilder(entityManager).build().id!! }
    private fun newSongId(): Long = inTx { TestSongBuilder(entityManager).build().id!! }

    private fun addWord(userId: Long, japanese: String, songId: Long? = null): Long =
        wordService.addWord(
            userId,
            AddWordDto(japanese = japanese, reading = null, senses = listOf(sense("뜻")), songId = songId),
        )

    private fun batchAdd(userId: Long, japanese: List<String>, songId: Long? = null) =
        wordService.batchAddWords(
            userId,
            BatchAddWordDto(
                words = japanese.map { AddWordDto(japanese = it, senses = listOf(sense("뜻")), songId = songId) },
            ),
        )

    @Nested
    inner class FlashcardSharesTheWordLifecycle {

        @Test
        fun `saving a word creates its flashcard in the same commit`() {
            val userId = newUserId()

            val wordId = addWord(userId, "命")

            assertThat(flashcardRepository.findByWordId(wordId)).isNotNull
        }

        @Test
        fun `re-saving the same word keeps exactly one word and one flashcard`() {
            val userId = newUserId()

            val first = addWord(userId, "命")
            val second = addWord(userId, "命")

            assertThat(second).isEqualTo(first)
            assertThat(wordRepository.findByUserIdOrderByIdDesc(userId, Pageable.unpaged())).hasSize(1)
            assertThat(flashcardRepository.findByUserId(userId)).hasSize(1)
        }

        @Test
        fun `every batch-saved word gets a flashcard`() {
            val userId = newUserId()

            batchAdd(userId, listOf("空", "海", "森"))

            val words = wordRepository.findByUserIdOrderByIdDesc(userId, Pageable.unpaged())
            assertThat(words).hasSize(3)
            assertThat(words.map { flashcardRepository.findByWordId(it.id!!) }).doesNotContainNull()
        }

        @Test
        fun `deleting a word deletes its flashcard`() {
            val userId = newUserId()
            val wordId = addWord(userId, "命")

            wordService.deleteWord(userId, wordId)

            assertThat(wordRepository.findById(wordId)).isEmpty
            assertThat(flashcardRepository.findByWordId(wordId)).isNull()
        }
    }

    @Nested
    inner class EveryWordBelongsToTheDefaultDeck {

        @Test
        fun `a word saved outside a song is still linked to the default deck`() {
            val userId = newUserId()

            val wordId = addWord(userId, "独立")

            val defaultDeck = deckRepository.findByUserIdAndIsDefaultTrue(userId)!!
            assertThat(deckWordRepository.existsByDeckIdAndWordId(defaultDeck.id!!, wordId)).isTrue
            assertThat(deckRepository.findByUserIdOrderByCreatedAtDesc(userId, Pageable.unpaged())).hasSize(1)
        }

        @Test
        fun `a word saved from a song is linked to both the song deck and the default deck`() {
            val userId = newUserId()
            val songId = newSongId()

            val wordId = addWord(userId, "流れる", songId)

            val songDeck = deckRepository.findByUserIdAndSongId(userId, songId)!!
            val defaultDeck = deckRepository.findByUserIdAndIsDefaultTrue(userId)!!
            assertThat(deckWordRepository.existsByDeckIdAndWordId(songDeck.id!!, wordId)).isTrue
            assertThat(deckWordRepository.existsByDeckIdAndWordId(defaultDeck.id!!, wordId)).isTrue
        }

        @Test
        fun `every batch-saved word is linked to the default deck`() {
            val userId = newUserId()

            batchAdd(userId, listOf("空", "海", "森"))

            val defaultDeck = deckRepository.findByUserIdAndIsDefaultTrue(userId)!!
            val linked = deckWordRepository.findByDeckId(defaultDeck.id!!).map { it.wordId }
            assertThat(linked).hasSize(3)
        }

        @Test
        fun `the default deck cannot be deleted`() {
            val userId = newUserId()
            addWord(userId, "命")
            val defaultDeckId = deckRepository.findByUserIdAndIsDefaultTrue(userId)!!.id!!

            assertThatThrownBy { deckService.deleteDeck(userId, defaultDeckId) }
                .isInstanceOf(BusinessException::class.java)

            assertThat(deckRepository.findById(defaultDeckId)).isPresent
        }
    }

    @Nested
    inner class DecksOutliveWords {

        @Test
        fun `emptying a song deck does not delete it`() {
            val userId = newUserId()
            val songId = newSongId()
            val wordId = addWord(userId, "流れる", songId)
            val songDeckId = deckRepository.findByUserIdAndSongId(userId, songId)!!.id!!

            wordService.deleteWord(userId, wordId)

            assertThat(deckRepository.findById(songDeckId)).isPresent
            assertThat(deckWordRepository.findByDeckId(songDeckId)).isEmpty()
        }

        @Test
        fun `deleting a song deck keeps its words, their flashcards and the default deck link`() {
            val userId = newUserId()
            val songId = newSongId()
            val wordId = addWord(userId, "流れる", songId)
            val songDeckId = deckRepository.findByUserIdAndSongId(userId, songId)!!.id!!
            val defaultDeckId = deckRepository.findByUserIdAndIsDefaultTrue(userId)!!.id!!

            deckService.deleteDeck(userId, songDeckId)

            assertThat(deckRepository.findById(songDeckId)).isEmpty
            assertThat(wordRepository.findById(wordId)).isPresent
            assertThat(flashcardRepository.findByWordId(wordId)).isNotNull
            assertThat(deckWordRepository.existsByDeckIdAndWordId(defaultDeckId, wordId)).isTrue
        }
    }

    @Nested
    inner class SaveIsAtomic {

        @Test
        fun `an unknown song id leaves no word behind`() {
            val userId = newUserId()

            assertThatThrownBy { addWord(userId, "幻", songId = 999_999L) }
                .isInstanceOf(BusinessException::class.java)

            assertThat(wordRepository.findByUserIdAndJapaneseText(userId, "幻")).isNull()
            assertThat(deckRepository.findByUserIdOrderByCreatedAtDesc(userId, Pageable.unpaged())).isEmpty()
        }
    }

    @Nested
    inner class ConcurrentSavesDoNotCollide {

        /**
         * deck 생성이 단어 저장과 같은 트랜잭션에 있으므로, 여기서 UNIQUE 충돌이 예외로 터지면
         * 단어 저장까지 롤백된다. 충돌 흡수 upsert 가 실제로 동작하는지 확인한다.
         */
        @Test
        fun `four concurrent saves for the same user and song all end up linked`() {
            val userId = newUserId()
            val songId = newSongId()
            val japanese = listOf("空", "海", "森", "星")

            runConcurrently(japanese) { addWord(userId, it, songId) }

            val songDeck = deckRepository.findByUserIdAndSongId(userId, songId)!!
            val defaultDeck = deckRepository.findByUserIdAndIsDefaultTrue(userId)!!
            assertThat(deckWordRepository.findByDeckId(songDeck.id!!)).hasSize(4)
            assertThat(deckWordRepository.findByDeckId(defaultDeck.id!!)).hasSize(4)
        }

        @Test
        fun `four concurrent saves without a song create exactly one default deck`() {
            val userId = newUserId()

            runConcurrently(listOf("空", "海", "森", "星")) { addWord(userId, it) }

            val decks = deckRepository.findByUserIdOrderByCreatedAtDesc(userId, Pageable.unpaged())
            assertThat(decks).hasSize(1)
            assertThat(decks.single().isDefault).isTrue
            assertThat(deckWordRepository.findByDeckId(decks.single().id!!)).hasSize(4)
        }

        /** 배치는 단어 수만큼 경합 구간이 길어지므로 단건보다 부딪히기 쉽다. */
        @Test
        fun `four concurrent batch saves for the same user and song all end up linked`() {
            val userId = newUserId()
            val songId = newSongId()
            val batches = listOf("空海森", "星月風", "山川海", "火水土")

            runConcurrently(batches) { batch -> batchAdd(userId, batch.map(Char::toString), songId) }

            val songDeck = deckRepository.findByUserIdAndSongId(userId, songId)!!
            val defaultDeck = deckRepository.findByUserIdAndIsDefaultTrue(userId)!!
            val distinctWords = batches.flatMap { it.toList() }.distinct().size
            assertThat(deckWordRepository.findByDeckId(songDeck.id!!)).hasSize(distinctWords)
            assertThat(deckWordRepository.findByDeckId(defaultDeck.id!!)).hasSize(distinctWords)
        }

        private fun runConcurrently(items: List<String>, action: (String) -> Unit) {
            val pool = Executors.newFixedThreadPool(items.size)
            val start = CountDownLatch(1)
            try {
                val futures = items.map { item -> pool.submit { start.await(); action(item) } }
                start.countDown()
                futures.forEach { it.get(30, TimeUnit.SECONDS) }
            } finally {
                pool.shutdownNow()
            }
        }
    }
}
