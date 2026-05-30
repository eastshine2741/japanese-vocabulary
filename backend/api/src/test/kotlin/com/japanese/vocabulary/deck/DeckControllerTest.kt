package com.japanese.vocabulary.deck

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.deck.dto.DeckDetailResponse
import com.japanese.vocabulary.deck.dto.DeckListResponse
import com.japanese.vocabulary.deck.dto.DeckWordListResponse
import com.japanese.vocabulary.deck.entity.DeckEntity
import com.japanese.vocabulary.deck.entity.DeckFlashcardEntity
import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.test.ApiBaseIntegrationTest
import com.japanese.vocabulary.test.fixtures.TestFlashcardBuilder
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.test.fixtures.TestWordBuilder
import com.japanese.vocabulary.user.entity.UserEntity
import com.japanese.vocabulary.word.entity.SongWordEntity
import com.japanese.vocabulary.word.entity.WordEntity
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import java.time.Duration
import java.time.Instant

@AutoConfigureMockMvc
class DeckControllerTest : ApiBaseIntegrationTest() {

    @Autowired private lateinit var mockMvc: MockMvc
    @Autowired private lateinit var objectMapper: ObjectMapper
    @Autowired private lateinit var jwtUtil: JwtUtil

    private fun newUser(): UserEntity = TestUserBuilder(entityManager).build()
    private fun newSong(): SongEntity = TestSongBuilder(entityManager).build()
    private fun newWord(user: UserEntity): WordEntity = TestWordBuilder(entityManager).forUser(user).build()
    private fun newCard(
        user: UserEntity,
        word: WordEntity = newWord(user),
        dueAt: Instant = clock.instant(),
        state: Int = 0,
        lastReviewedAt: Instant? = null,
    ): FlashcardEntity = TestFlashcardBuilder(entityManager, clock)
        .forUser(user)
        .ofWord(word)
        .dueAt(dueAt)
        .withState(state)
        .lastReviewedAt(lastReviewedAt)
        .build()

    private fun newDeck(user: UserEntity, song: SongEntity): DeckEntity {
        val deck = DeckEntity(
            userId = user.id!!,
            songId = song.id!!,
            title = song.title,
            description = song.artist,
        )
        entityManager.persist(deck)
        entityManager.flush()
        return deck
    }

    private fun link(deck: DeckEntity, card: FlashcardEntity) {
        entityManager.persist(DeckFlashcardEntity(deckId = deck.id!!, flashcardId = card.id!!))
        entityManager.flush()
    }

    private fun linkWordToSong(word: WordEntity, song: SongEntity, lyric: String = "행"): SongWordEntity =
        SongWordEntity(wordId = word.id!!, songId = song.id!!, lyricLine = lyric).also {
            entityManager.persist(it); entityManager.flush()
        }

    private fun bearer(user: UserEntity): String = "Bearer ${jwtUtil.generateToken(user.id!!, user.username)}"
    private inline fun <reified T> readBody(json: String): T = objectMapper.readValue(json)

    @Nested
    inner class GetList {

        @Test
        fun `empty when user has no decks`() {
            val me = newUser()

            val body = mockMvc.get("/api/decks") {
                header("Authorization", bearer(me))
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            val resp = readBody<DeckListResponse>(body)
            assertThat(resp.songDecks).isEmpty()
            assertThat(resp.nextCursor).isNull()
        }

        @Test
        fun `returns own decks with stats, isolated from other users`() {
            val me = newUser()
            val other = newUser()
            val song = newSong()
            val deck = newDeck(me, song)
            val word = newWord(me)
            // due card in REVIEW state — counts as both due and mastered
            val card = newCard(me, word, dueAt = clock.instant().minus(Duration.ofMinutes(1)), state = 1)
            link(deck, card)

            // Other user has their own deck — must not appear
            newDeck(other, song)

            val body = mockMvc.get("/api/decks") {
                header("Authorization", bearer(me))
            }.andReturn().response.contentAsString

            val resp = readBody<DeckListResponse>(body)
            assertThat(resp.songDecks).hasSize(1)
            val summary = resp.songDecks.single()
            assertThat(summary.deckId).isEqualTo(deck.id)
            assertThat(summary.songId).isEqualTo(song.id)
            assertThat(summary.wordCount).isEqualTo(1)
            assertThat(summary.dueCount).isEqualTo(1)
            assertThat(summary.masteredCount).isEqualTo(1)
        }
    }

    @Nested
    inner class GetAllDeckDetail {

        @Test
        fun `aggregates stats across all of the user's flashcards`() {
            val me = newUser()
            val now = clock.instant()
            // 1 mastered (state=1) due now
            newCard(me, dueAt = now.minus(Duration.ofMinutes(1)), state = 1, lastReviewedAt = now)
            // 1 studying (state=0 with lastReview)
            newCard(me, dueAt = now.plus(Duration.ofDays(1)), state = 0, lastReviewedAt = now)
            // 1 new (state=0, lastReview null) due now
            newCard(me, dueAt = now.minus(Duration.ofMinutes(2)), state = 0, lastReviewedAt = null)

            val body = mockMvc.get("/api/decks/all") {
                header("Authorization", bearer(me))
            }.andReturn().response.contentAsString

            val resp = readBody<DeckDetailResponse>(body)
            assertThat(resp.wordCount).isEqualTo(3)
            assertThat(resp.dueCount).isEqualTo(2)
            assertThat(resp.masteredCount).isEqualTo(1)
            assertThat(resp.studyingCount).isEqualTo(1)
            assertThat(resp.newWordCount).isEqualTo(1)
        }

        @Test
        fun `all-zero when user has no cards`() {
            val me = newUser()

            val body = mockMvc.get("/api/decks/all") {
                header("Authorization", bearer(me))
            }.andReturn().response.contentAsString

            val resp = readBody<DeckDetailResponse>(body)
            assertThat(resp.wordCount).isZero
        }
    }

    @Nested
    inner class GetAllWords {

        @Test
        fun `returns the user's words (any deck) excluding other users`() {
            val me = newUser()
            val other = newUser()
            val mine = (1..2).map { newWord(me) }
            newWord(other)

            val body = mockMvc.get("/api/decks/all/words") {
                header("Authorization", bearer(me))
            }.andReturn().response.contentAsString

            val resp = readBody<DeckWordListResponse>(body)
            assertThat(resp.words.map { it.id }).containsExactlyInAnyOrderElementsOf(mine.map { it.id })
        }
    }

    @Nested
    inner class GetBySong {

        @Test
        fun `returns deck detail when the user has a deck for this song`() {
            val me = newUser()
            val song = newSong()
            val deck = newDeck(me, song)
            val card = newCard(me)
            link(deck, card)

            val body = mockMvc.get("/api/decks/by-song/${song.id}") {
                header("Authorization", bearer(me))
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            val resp = readBody<DeckDetailResponse>(body)
            assertThat(resp.deckId).isEqualTo(deck.id)
            assertThat(resp.songId).isEqualTo(song.id)
        }

        @Test
        fun `returns 204 No Content when the user has no deck for this song`() {
            val me = newUser()
            val song = newSong()

            mockMvc.get("/api/decks/by-song/${song.id}") {
                header("Authorization", bearer(me))
            }.andExpect { status { isNoContent() } }
        }
    }

    @Nested
    inner class GetDetail {

        @Test
        fun `returns detail with accurate stats for the deck`() {
            val me = newUser()
            val song = newSong()
            val deck = newDeck(me, song)
            val now = clock.instant()
            val mastered = newCard(me, dueAt = now.minus(Duration.ofMinutes(1)), state = 1, lastReviewedAt = now)
            val studying = newCard(me, dueAt = now.plus(Duration.ofDays(1)), state = 0, lastReviewedAt = now)
            val newWord = newCard(me, dueAt = now.minus(Duration.ofMinutes(2)), state = 0, lastReviewedAt = null)
            link(deck, mastered); link(deck, studying); link(deck, newWord)

            val body = mockMvc.get("/api/decks/${deck.id}") {
                header("Authorization", bearer(me))
            }.andReturn().response.contentAsString

            val resp = readBody<DeckDetailResponse>(body)
            assertThat(resp.wordCount).isEqualTo(3)
            assertThat(resp.dueCount).isEqualTo(2)
            assertThat(resp.masteredCount).isEqualTo(1)
            assertThat(resp.studyingCount).isEqualTo(1)
            assertThat(resp.newWordCount).isEqualTo(1)
        }

        @Test
        fun `another user's deck is forbidden`() {
            val me = newUser()
            val other = newUser()
            val song = newSong()
            val theirDeck = newDeck(other, song)

            mockMvc.get("/api/decks/${theirDeck.id}") {
                header("Authorization", bearer(me))
            }.andExpect { status { isForbidden() } }
        }

        @Test
        fun `unknown deckId returns 404`() {
            val me = newUser()

            mockMvc.get("/api/decks/999999") {
                header("Authorization", bearer(me))
            }.andExpect { status { isNotFound() } }
        }
    }

    @Nested
    inner class GetDeckWords {

        @Test
        fun `returns words belonging to the deck's song`() {
            val me = newUser()
            val song = newSong()
            val deck = newDeck(me, song)
            val w1 = newWord(me)
            val w2 = newWord(me)
            val unrelated = newWord(me)
            linkWordToSong(w1, song, "행1")
            linkWordToSong(w2, song, "행2")

            val body = mockMvc.get("/api/decks/${deck.id}/words") {
                header("Authorization", bearer(me))
            }.andReturn().response.contentAsString

            val resp = readBody<DeckWordListResponse>(body)
            assertThat(resp.words.map { it.id }).containsExactlyInAnyOrder(w1.id, w2.id)
            assertThat(resp.words.map { it.id }).doesNotContain(unrelated.id)
        }

        @Test
        fun `another user's deck words is forbidden`() {
            val me = newUser()
            val other = newUser()
            val song = newSong()
            val theirDeck = newDeck(other, song)

            mockMvc.get("/api/decks/${theirDeck.id}/words") {
                header("Authorization", bearer(me))
            }.andExpect { status { isForbidden() } }
        }
    }
}
