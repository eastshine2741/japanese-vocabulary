package com.japanese.vocabulary.user

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.deck.entity.DeckEntity
import com.japanese.vocabulary.deck.entity.DeckWordEntity
import com.japanese.vocabulary.featureflag.FeatureFlagKeys
import com.japanese.vocabulary.flashcard.dto.ReviewRequest
import com.japanese.vocabulary.rewardcard.dto.RewardCardsResponse
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.model.LyricWordCandidates
import com.japanese.vocabulary.song.model.WordCandidate
import com.japanese.vocabulary.song.model.WordScoreComponents
import com.japanese.vocabulary.test.ApiBaseIntegrationTest
import com.japanese.vocabulary.test.fixtures.TestFlashcardBuilder
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.test.fixtures.TestWordBuilder
import com.japanese.vocabulary.user.entity.UserEntity
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import java.time.Instant

@AutoConfigureMockMvc
class UserPublicProfileControllerTest : ApiBaseIntegrationTest() {

    @Autowired private lateinit var mockMvc: MockMvc
    @Autowired private lateinit var objectMapper: ObjectMapper
    @Autowired private lateinit var jwtUtil: JwtUtil

    private fun newUser(block: TestUserBuilder.() -> Unit = {}): UserEntity =
        TestUserBuilder(entityManager).apply(block).build()

    private fun bearer(user: UserEntity) = "Bearer ${jwtUtil.generateToken(user.id!!, user.username)}"

    private fun newSong(): SongEntity {
        val song = TestSongBuilder(entityManager).build()
        val lyric = LyricEntity(
            songId = song.id!!,
            lyricType = LyricType.PLAIN,
            rawContent = listOf(LyricLineData(index = 0, startTimeMs = null, text = "후렴")),
            wordCandidates = LyricWordCandidates(
                candidates = listOf(
                    WordCandidate(
                        japanese = "輪郭",
                        surface = "輪郭",
                        baseForm = "輪郭",
                        reading = null,
                        baseFormReading = null,
                        koreanText = "윤곽",
                        partOfSpeech = "NOUN",
                        partOfSpeechLabel = "NOUN",
                        jlpt = null,
                        importanceScore = 50.0,
                        appearanceOrder = 0,
                        frequency = 1,
                        lineIndexes = listOf(0),
                        scoreComponents = WordScoreComponents(0.0, 0.0, 0.0, 0.0, 1.0),
                    ),
                ),
                lineCandidates = mapOf("0" to listOf(0)),
            ),
        )
        entityManager.persist(lyric)
        song.activeLyricId = lyric.id
        entityManager.flush()
        return song
    }

    /** 곡 단어장에 단어 하나를 담고 rating 해 곡 카드를 얻는다. */
    private fun studySong(user: UserEntity, song: SongEntity) {
        val deck = DeckEntity(userId = user.id!!, songId = song.id!!, title = song.title, description = song.artist)
            .also { entityManager.persist(it) }
        val word = TestWordBuilder(entityManager).forUser(user).withJapaneseText("輪郭").build()
        entityManager.persist(DeckWordEntity(deckId = deck.id!!, wordId = word.id!!))
        val card = TestFlashcardBuilder(entityManager, clock).forUser(user).ofWord(word).dueAt(clock.instant()).build()
        entityManager.flush()
        mockMvc.post("/api/flashcards/${card.id}/review") {
            header("Authorization", bearer(user))
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(ReviewRequest(rating = 3))
        }.andExpect { status { isOk() } }
    }

    private fun rewardCardsOf(viewer: UserEntity, owner: UserEntity): RewardCardsResponse =
        objectMapper.readValue(
            mockMvc.get("/api/users/${owner.id}/reward-cards") { header("Authorization", bearer(viewer)) }
                .andExpect { status { isOk() } }.andReturn().response.contentAsString,
        )

    @Test
    fun `profile shows public fields without email and tells whether it is me`() {
        val owner = newUser { withUsername("singer"); withName("Singer"); withEmail("singer@example.com") }
        val viewer = newUser()

        mockMvc.get("/api/users/${owner.id}") { header("Authorization", bearer(viewer)) }.andExpect {
            status { isOk() }
            jsonPath("$.userId") { value(owner.id!!) }
            jsonPath("$.username") { value("singer") }
            jsonPath("$.name") { value("Singer") }
            jsonPath("$.me") { value(false) }
            jsonPath("$.email") { doesNotExist() }
        }
        mockMvc.get("/api/users/${owner.id}") { header("Authorization", bearer(owner)) }.andExpect {
            jsonPath("$.me") { value(true) }
        }
    }

    @Test
    fun `deleted user is not found`() {
        val owner = newUser()
        owner.deletedAt = Instant.now()
        entityManager.flush()
        val viewer = newUser()

        for (path in listOf("", "/reward-cards", "/flashcard-stats", "/decks", "/study-stats/heatmap")) {
            mockMvc.get("/api/users/${owner.id}$path") { header("Authorization", bearer(viewer)) }.andExpect {
                status { isNotFound() }
                jsonPath("$.error") { value("USER_NOT_FOUND") }
            }
        }
    }

    @Test
    fun `reward cards show only issued cards`() {
        turnOn(FeatureFlagKeys.REWARD_CARD)
        val owner = newUser()
        val viewer = newUser()
        studySong(owner, newSong())

        assertThat(rewardCardsOf(viewer, owner).songCards).isEmpty()

        val issuedId = objectMapper.readValue<RewardCardsResponse>(
            mockMvc.get("/api/reward-cards") { header("Authorization", bearer(owner)) }
                .andReturn().response.contentAsString,
        ).songCards.first().id
        mockMvc.post("/api/reward-cards/song-cards/$issuedId/issue") {
            header("Authorization", bearer(owner))
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(mapOf("signature" to listOf("M 10 10 Q 20 20 30 10")))
        }.andExpect { status { isNoContent() } }

        assertThat(rewardCardsOf(viewer, owner).songCards.map { it.id }).containsExactly(issuedId)
    }

    @Test
    fun `study tab shows the owner's decks and word stats`() {
        val owner = newUser()
        val viewer = newUser()
        val song = newSong()
        studySong(owner, song)

        mockMvc.get("/api/users/${owner.id}/decks") { header("Authorization", bearer(viewer)) }.andExpect {
            status { isOk() }
            jsonPath("$.songDecks[0].songId") { value(song.id!!) }
            jsonPath("$.songDecks[0].wordCount") { value(1) }
        }
        mockMvc.get("/api/users/${owner.id}/flashcard-stats") { header("Authorization", bearer(viewer)) }.andExpect {
            status { isOk() }
            jsonPath("$.total") { value(1) }
        }
        mockMvc.get("/api/users/${viewer.id}/flashcard-stats") { header("Authorization", bearer(owner)) }.andExpect {
            jsonPath("$.total") { value(0) }
        }
        mockMvc.get("/api/users/${owner.id}/study-stats/heatmap") { header("Authorization", bearer(viewer)) }.andExpect {
            status { isOk() }
        }
    }
}
