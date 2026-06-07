package com.japanese.vocabulary.flashcard

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.deck.entity.DeckEntity
import com.japanese.vocabulary.deck.entity.DeckFlashcardEntity
import com.japanese.vocabulary.flashcard.dto.DueFlashcardsResponse
import com.japanese.vocabulary.flashcard.dto.FlashcardStatsResponse
import com.japanese.vocabulary.flashcard.dto.ReviewRequest
import com.japanese.vocabulary.flashcard.dto.ReviewResponse
import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import com.japanese.vocabulary.flashcard.event.FlashcardReviewedEvent
import com.japanese.vocabulary.flashcard.repository.FlashcardRepository
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.test.ApiBaseIntegrationTest
import com.japanese.vocabulary.test.fixtures.TestFlashcardBuilder
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.test.fixtures.TestWordBuilder
import com.japanese.vocabulary.user.entity.UserEntity
import com.japanese.vocabulary.user.entity.UserSettingsEntity
import com.japanese.vocabulary.user.model.UserSettingsData
import com.japanese.vocabulary.word.entity.WordEntity
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.context.event.ApplicationEvents
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import java.time.Duration
import java.time.Instant

@AutoConfigureMockMvc
class FlashcardControllerTest : ApiBaseIntegrationTest() {

    @Autowired private lateinit var mockMvc: MockMvc
    @Autowired private lateinit var objectMapper: ObjectMapper
    @Autowired private lateinit var jwtUtil: JwtUtil
    @Autowired private lateinit var flashcardRepository: FlashcardRepository
    @Autowired private lateinit var applicationEvents: ApplicationEvents

    private fun newUser(): UserEntity = TestUserBuilder(entityManager).build()

    private fun newWord(user: UserEntity, japanese: String? = null): WordEntity =
        TestWordBuilder(entityManager).forUser(user).let {
            if (japanese != null) it.withJapaneseText(japanese) else it
        }.build()

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

    private fun newSong(): SongEntity = TestSongBuilder(entityManager).build()

    private fun linkCardToSongDeck(user: UserEntity, song: SongEntity, card: FlashcardEntity) {
        val deck = DeckEntity(
            userId = user.id!!,
            songId = song.id!!,
            title = song.title,
            description = song.artist,
        )
        entityManager.persist(deck)
        entityManager.flush()
        entityManager.persist(DeckFlashcardEntity(deckId = deck.id!!, flashcardId = card.id!!))
        entityManager.flush()
    }

    private fun saveSettings(user: UserEntity, showIntervals: Boolean) {
        entityManager.persist(
            UserSettingsEntity(
                userId = user.id!!,
                settings = UserSettingsData(showIntervals = showIntervals),
            ),
        )
        entityManager.flush()
    }

    private fun bearer(user: UserEntity): String = "Bearer ${jwtUtil.generateToken(user.id!!, user.username)}"

    private inline fun <reified T> readBody(json: String): T = objectMapper.readValue(json, T::class.java)

    @Nested
    inner class Due {

        @Test
        fun `returns empty when user has no cards`() {
            val me = newUser()

            val body = mockMvc.get("/api/flashcards/due") {
                header("Authorization", bearer(me))
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            val resp = readBody<DueFlashcardsResponse>(body)
            assertThat(resp.totalCount).isEqualTo(0)
            assertThat(resp.cards).isEmpty()
        }

        @Test
        fun `returns only cards whose due is at or before now`() {
            val me = newUser()
            newCard(me, dueAt = clock.instant().minus(Duration.ofHours(1)))
            newCard(me, dueAt = clock.instant().plus(Duration.ofDays(1)))

            val body = mockMvc.get("/api/flashcards/due") {
                header("Authorization", bearer(me))
            }.andReturn().response.contentAsString

            assertThat(readBody<DueFlashcardsResponse>(body).totalCount).isEqualTo(1)
        }

        @Test
        fun `excludes other users' cards`() {
            val me = newUser()
            val other = newUser()
            newCard(other, dueAt = clock.instant().minus(Duration.ofMinutes(5)))

            val body = mockMvc.get("/api/flashcards/due") {
                header("Authorization", bearer(me))
            }.andReturn().response.contentAsString

            assertThat(readBody<DueFlashcardsResponse>(body).totalCount).isEqualTo(0)
        }

        @Test
        fun `songId filter returns only cards linked via that song's deck`() {
            val me = newUser()
            val song = newSong()
            val otherSong = newSong()

            val linkedCard = newCard(me, dueAt = clock.instant().minus(Duration.ofHours(1)))
            linkCardToSongDeck(me, song, linkedCard)

            val unlinkedCard = newCard(me, dueAt = clock.instant().minus(Duration.ofHours(1)))
            linkCardToSongDeck(me, otherSong, unlinkedCard)

            val body = mockMvc.get("/api/flashcards/due") {
                header("Authorization", bearer(me))
                param("songId", song.id!!.toString())
            }.andReturn().response.contentAsString

            val resp = readBody<DueFlashcardsResponse>(body)
            assertThat(resp.totalCount).isEqualTo(1)
            assertThat(resp.cards.single().id).isEqualTo(linkedCard.id)
        }

        @Test
        fun `omits intervals when user disabled showIntervals`() {
            val me = newUser()
            saveSettings(me, showIntervals = false)
            newCard(me, dueAt = clock.instant().minus(Duration.ofMinutes(1)))

            val body = mockMvc.get("/api/flashcards/due") {
                header("Authorization", bearer(me))
            }.andReturn().response.contentAsString

            val card = readBody<DueFlashcardsResponse>(body).cards.single()
            assertThat(card.intervals).isNull()
        }

        @Test
        fun `includes intervals 1-4 when showIntervals is default true`() {
            val me = newUser()
            newCard(me, dueAt = clock.instant().minus(Duration.ofMinutes(1)))

            val body = mockMvc.get("/api/flashcards/due") {
                header("Authorization", bearer(me))
            }.andReturn().response.contentAsString

            val card = readBody<DueFlashcardsResponse>(body).cards.single()
            assertThat(card.intervals?.keys).containsExactlyInAnyOrder(1, 2, 3, 4)
        }
    }

    @Nested
    inner class Review {

        @Test
        fun `updates card and publishes FlashcardReviewedEvent`() {
            val me = newUser()
            val card = newCard(me, dueAt = clock.instant().minus(Duration.ofHours(1)))
            val originalDue = card.due

            val body = mockMvc.post("/api/flashcards/${card.id}/review") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(ReviewRequest(rating = 3))
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            val resp = readBody<ReviewResponse>(body)
            assertThat(resp.id).isEqualTo(card.id)
            assertThat(Instant.parse(resp.due)).isAfter(originalDue)

            entityManager.flush(); entityManager.clear()
            val reloaded = flashcardRepository.findById(card.id!!).get()
            assertThat(reloaded.lastReview).isEqualTo(clock.instant())
            assertThat(reloaded.due).isAfter(originalDue)
            assertThat(reloaded.fsrsCardJson).isNotEqualTo("{}")

            val events = applicationEvents.stream(FlashcardReviewedEvent::class.java).toList()
            assertThat(events).hasSize(1)
            val event = events.single()
            assertThat(event.flashcardId).isEqualTo(card.id)
            assertThat(event.userId).isEqualTo(me.id)
            assertThat(event.rating).isEqualTo(3)
        }

        @Test
        fun `reviewing another user's card is forbidden`() {
            val me = newUser()
            val other = newUser()
            val theirCard = newCard(other)

            mockMvc.post("/api/flashcards/${theirCard.id}/review") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(ReviewRequest(rating = 3))
            }.andExpect { status { isForbidden() } }

            assertThat(applicationEvents.stream(FlashcardReviewedEvent::class.java).toList()).isEmpty()
        }

        @Test
        fun `unknown flashcard id returns 404`() {
            val me = newUser()

            mockMvc.post("/api/flashcards/999999/review") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(ReviewRequest(rating = 3))
            }.andExpect { status { isNotFound() } }
        }

        @Test
        fun `rating out of 1-4 range returns 400`() {
            val me = newUser()
            val card = newCard(me)

            mockMvc.post("/api/flashcards/${card.id}/review") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(ReviewRequest(rating = 5))
            }.andExpect { status { isBadRequest() } }

            assertThat(applicationEvents.stream(FlashcardReviewedEvent::class.java).toList()).isEmpty()
        }
    }

    @Nested
    inner class Stats {

        @Test
        fun `all zero when user has no cards`() {
            val me = newUser()

            val body = mockMvc.get("/api/flashcards/stats") {
                header("Authorization", bearer(me))
            }.andReturn().response.contentAsString

            val resp = readBody<FlashcardStatsResponse>(body)
            assertThat(resp.total).isZero
            assertThat(resp.due).isZero
            assertThat(resp.newCount).isZero
            assertThat(resp.learning).isZero
            assertThat(resp.review).isZero
        }

        @Test
        fun `counts total, due, new, learning, review accurately`() {
            val me = newUser()
            val now = clock.instant()
            // new (state=0/LEARNING, lastReview=null) — also due (due<=now)
            newCard(me, dueAt = now.minus(Duration.ofMinutes(1)), state = 0, lastReviewedAt = null)
            // learning (state=0, lastReview=set) — also due
            newCard(me, dueAt = now.minus(Duration.ofMinutes(1)), state = 0, lastReviewedAt = now)
            // review (state=1) — due in future, not counted as due
            newCard(me, dueAt = now.plus(Duration.ofDays(1)), state = 1, lastReviewedAt = now)
            // relearning (state=2) — also learning bucket per service formula
            newCard(me, dueAt = now.plus(Duration.ofDays(1)), state = 2, lastReviewedAt = now)

            val body = mockMvc.get("/api/flashcards/stats") {
                header("Authorization", bearer(me))
            }.andReturn().response.contentAsString

            val resp = readBody<FlashcardStatsResponse>(body)
            assertThat(resp.total).isEqualTo(4)
            assertThat(resp.due).isEqualTo(2)
            assertThat(resp.newCount).isEqualTo(1)
            // learning = (state=0 count + state=2 count) - newCount = (2 + 1) - 1 = 2
            assertThat(resp.learning).isEqualTo(2)
            assertThat(resp.review).isEqualTo(1)
        }

        @Test
        fun `other users' cards do not contribute`() {
            val me = newUser()
            val other = newUser()
            newCard(other, dueAt = clock.instant().minus(Duration.ofMinutes(1)))
            newCard(other, dueAt = clock.instant().minus(Duration.ofMinutes(1)))

            val body = mockMvc.get("/api/flashcards/stats") {
                header("Authorization", bearer(me))
            }.andReturn().response.contentAsString

            assertThat(readBody<FlashcardStatsResponse>(body).total).isZero
        }
    }
}
