package com.japanese.vocabulary.deck

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.deck.dto.CreateDeckRequest
import com.japanese.vocabulary.deck.dto.DeckDetailResponse
import com.japanese.vocabulary.deck.dto.DeckListResponse
import com.japanese.vocabulary.deck.dto.DeckResponse
import com.japanese.vocabulary.deck.dto.DeckWordListResponse
import com.japanese.vocabulary.deck.entity.DeckEntity
import com.japanese.vocabulary.deck.entity.DeckWordEntity
import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.test.ApiBaseIntegrationTest
import com.japanese.vocabulary.test.fixtures.TestFlashcardBuilder
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.test.fixtures.TestWordBuilder
import com.japanese.vocabulary.user.entity.UserEntity
import com.japanese.vocabulary.word.entity.WordEntity
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
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

    private fun newDefaultDeck(user: UserEntity): DeckEntity {
        val deck = DeckEntity(userId = user.id!!, isDefault = true, title = "전체 단어장", description = "")
        entityManager.persist(deck)
        entityManager.flush()
        return deck
    }

    private fun link(deck: DeckEntity, word: WordEntity) {
        entityManager.persist(DeckWordEntity(deckId = deck.id!!, wordId = word.id!!))
        entityManager.flush()
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
            newCard(me, word, dueAt = clock.instant().minus(Duration.ofMinutes(1)), state = 1)
            link(deck, word)

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

        @Test
        fun `wordCount counts words with no flashcard yet, and ignores words owned by someone else`() {
            val me = newUser()
            val other = newUser()
            val song = newSong()
            val deck = newDeck(me, song)
            val mine = newWord(me)
            val withoutCard = newWord(me)
            val foreign = newWord(other)
            newCard(me, mine)
            // withoutCard 는 flashcard 가 없다 — LEFT JOIN 이라 wordCount 에는 들어가야 한다.
            // foreign 은 남의 단어라 목록 통계에 새면 안 된다 (상세 통계는 user_id 로 이미 거른다).
            link(deck, mine); link(deck, withoutCard); link(deck, foreign)

            val listBody = mockMvc.get("/api/decks") {
                header("Authorization", bearer(me))
            }.andReturn().response.contentAsString
            val detailBody = mockMvc.get("/api/decks/${deck.id}") {
                header("Authorization", bearer(me))
            }.andReturn().response.contentAsString

            val summary = readBody<DeckListResponse>(listBody).songDecks.single()
            assertThat(summary.wordCount).isEqualTo(2)
            // 목록과 상세가 같은 숫자를 말해야 한다.
            assertThat(summary.wordCount).isEqualTo(readBody<DeckDetailResponse>(detailBody).wordCount)
        }

        @Test
        fun `the default deck is excluded from the list but general decks are included`() {
            val me = newUser()
            newDefaultDeck(me)
            val general = DeckEntity(userId = me.id!!, title = "내 단어장", description = "")
                .also { entityManager.persist(it); entityManager.flush() }

            val body = mockMvc.get("/api/decks") {
                header("Authorization", bearer(me))
            }.andReturn().response.contentAsString

            val resp = readBody<DeckListResponse>(body)
            assertThat(resp.songDecks.map { it.deckId }).containsExactly(general.id)
            assertThat(resp.songDecks.single().songId).isNull()
        }
    }

    @Nested
    inner class CreateDeck {

        @Test
        fun `creates a general deck that is mapped to no song`() {
            val me = newUser()

            val body = mockMvc.post("/api/decks") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(CreateDeckRequest(title = "JLPT N3", description = "시험용"))
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            val resp = readBody<DeckResponse>(body)
            assertThat(resp.songId).isNull()
            assertThat(resp.isDefault).isFalse
            assertThat(resp.title).isEqualTo("JLPT N3")
            assertThat(resp.description).isEqualTo("시험용")
        }

        @Test
        fun `blank title is rejected`() {
            val me = newUser()

            mockMvc.post("/api/decks") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(CreateDeckRequest(title = "   "))
            }.andExpect { status { isBadRequest() } }
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

        @Test
        fun `reports the materialised default deck id when one exists`() {
            val me = newUser()
            val defaultDeck = newDefaultDeck(me)

            val body = mockMvc.get("/api/decks/all") {
                header("Authorization", bearer(me))
            }.andReturn().response.contentAsString

            assertThat(readBody<DeckDetailResponse>(body).deckId).isEqualTo(defaultDeck.id)
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
            val word = newWord(me)
            newCard(me, word)
            link(deck, word)

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
            val masteredWord = newWord(me)
            val studyingWord = newWord(me)
            val newWord = newWord(me)
            newCard(me, masteredWord, dueAt = now.minus(Duration.ofMinutes(1)), state = 1, lastReviewedAt = now)
            newCard(me, studyingWord, dueAt = now.plus(Duration.ofDays(1)), state = 0, lastReviewedAt = now)
            newCard(me, newWord, dueAt = now.minus(Duration.ofMinutes(2)), state = 0, lastReviewedAt = null)
            link(deck, masteredWord); link(deck, studyingWord); link(deck, newWord)

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
        fun `returns words linked to the deck`() {
            val me = newUser()
            val song = newSong()
            val deck = newDeck(me, song)
            val w1 = newWord(me)
            val w2 = newWord(me)
            val unrelated = newWord(me)
            link(deck, w1)
            link(deck, w2)

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
