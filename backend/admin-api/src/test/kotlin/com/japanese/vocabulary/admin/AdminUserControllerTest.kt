package com.japanese.vocabulary.admin

import com.japanese.vocabulary.deck.entity.DeckEntity
import com.japanese.vocabulary.deck.entity.DeckWordEntity
import com.japanese.vocabulary.test.fixtures.TestFlashcardBuilder
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.test.fixtures.TestWordBuilder
import com.japanese.vocabulary.word.model.SenseExample
import com.japanese.vocabulary.word.model.WordSense
import org.junit.jupiter.api.Test
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.test.web.servlet.get
import java.time.Instant

@AutoConfigureMockMvc
class AdminUserControllerTest : AdminBaseIntegrationTest() {
    @Test
    fun `authenticated admin can inspect user detail`() {
        val user = TestUserBuilder(entityManager)
            .withUsername("adminread")
            .withEmail("adminread@example.com")
            .build()

        mockMvc.get("/admin/api/users/${user.id}") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isOk() }
            jsonPath("$.user.email") { value("adminread@example.com") }
            jsonPath("$.user.wordCount") { value(0) }
            jsonPath("$.learning.wordCount") { value(0) }
            jsonPath("$.learning.reviewDaysLast30") { value(0) }
            jsonPath("$.decks") { isEmpty() }
        }
    }

    @Test
    fun `soft deleted users stay visible to admin detail`() {
        val user = TestUserBuilder(entityManager).withUsername("deleteduser").build()
        user.deletedAt = Instant.parse("2026-01-01T00:00:00Z")
        entityManager.flush()

        mockMvc.get("/admin/api/users/${user.id}") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isOk() }
            jsonPath("$.user.deletedAt") { exists() }
        }
    }

    @Test
    fun `user list and detail expose saved words, decks and review state`() {
        val user = TestUserBuilder(entityManager).withUsername("learner").build()
        val song = TestSongBuilder(entityManager).withTitle("夜に駆ける").withArtist("YOASOBI").build()
        val now = Instant.now(clock)

        val reviewed = TestWordBuilder(entityManager).forUser(user).withJapaneseText("駆ける")
            .withSenses(
                listOf(
                    WordSense(
                        meaning = "달리다",
                        partOfSpeech = "동사",
                        jlpt = "N3",
                        examples = listOf(SenseExample(text = "夜に駆ける", translation = "밤을 달리다", songId = song.id, lineIndex = 0)),
                    ),
                ),
            )
            .build()
        TestFlashcardBuilder(entityManager, clock).forUser(user).ofWord(reviewed)
            .withState(1).lastReviewedAt(now.minusSeconds(3600)).dueAt(now.plusSeconds(86400)).build()

        val fresh = TestWordBuilder(entityManager).forUser(user).withJapaneseText("夜").build()
        TestFlashcardBuilder(entityManager, clock).forUser(user).ofWord(fresh).dueAt(now).build()

        val defaultDeck = DeckEntity(userId = user.id!!, isDefault = true, title = "전체", description = "")
        val songDeck = DeckEntity(userId = user.id!!, songId = song.id, title = "夜に駆ける", description = "YOASOBI")
        val customDeck = DeckEntity(userId = user.id!!, title = "내 단어장", description = "")
        listOf(defaultDeck, songDeck, customDeck).forEach { entityManager.persist(it) }
        entityManager.flush()
        listOf(reviewed, fresh).forEach { entityManager.persist(DeckWordEntity(deckId = defaultDeck.id!!, wordId = it.id!!)) }
        entityManager.persist(DeckWordEntity(deckId = songDeck.id!!, wordId = reviewed.id!!))
        entityManager.flush()
        entityManager.clear()

        val token = adminToken()

        mockMvc.get("/admin/api/users?q=learner") {
            header("Authorization", "Bearer $token")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].username") { value("learner") }
            jsonPath("$.content[0].wordCount") { value(2) }
            jsonPath("$.content[0].songDeckCount") { value(1) }
            jsonPath("$.content[0].customDeckCount") { value(1) }
            jsonPath("$.content[0].lastWordSavedAt") { exists() }
            jsonPath("$.content[0].lastReviewedAt") { exists() }
        }

        mockMvc.get("/admin/api/users/${user.id}") {
            header("Authorization", "Bearer $token")
        }.andExpect {
            status { isOk() }
            jsonPath("$.learning.wordCount") { value(2) }
            jsonPath("$.learning.newCount") { value(1) }
            jsonPath("$.learning.masteredCount") { value(1) }
            jsonPath("$.learning.dueCount") { value(1) }
            jsonPath("$.decks.length()") { value(3) }
            jsonPath("$.decks[?(@.kind == 'SONG')].songTitle") { value("夜に駆ける") }
            jsonPath("$.decks[?(@.kind == 'SONG')].wordCount") { value(1) }
            jsonPath("$.decks[?(@.kind == 'DEFAULT')].wordCount") { value(2) }
            jsonPath("$.decks[?(@.kind == 'CUSTOM')].wordCount") { value(0) }
        }

        mockMvc.get("/admin/api/users/${user.id}/words") {
            header("Authorization", "Bearer $token")
        }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(2) }
            jsonPath("$.content[0].japaneseText") { value("夜") }
            jsonPath("$.content[0].flashcard.status") { value("NEW") }
            jsonPath("$.content[1].japaneseText") { value("駆ける") }
            jsonPath("$.content[1].flashcard.status") { value("MASTERED") }
            jsonPath("$.content[1].senses[0].meaning") { value("달리다") }
            jsonPath("$.content[1].sourceSongs[0].title") { value("夜に駆ける") }
        }

        mockMvc.get("/admin/api/users/${user.id}/words?deckId=${songDeck.id}") {
            header("Authorization", "Bearer $token")
        }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(1) }
            jsonPath("$.content[0].japaneseText") { value("駆ける") }
        }

        mockMvc.get("/admin/api/users/${user.id}/words?q=夜") {
            header("Authorization", "Bearer $token")
        }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(1) }
            jsonPath("$.content[0].japaneseText") { value("夜") }
        }
    }

    @Test
    fun `words of unknown user return 404`() {
        mockMvc.get("/admin/api/users/999999/words") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isNotFound() }
        }
    }
}
