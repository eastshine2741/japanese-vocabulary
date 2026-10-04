package com.japanese.vocabulary.flashcard

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.flashcard.dto.StudyScheduleResponse
import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import com.japanese.vocabulary.flashcard.repository.FlashcardRepository
import com.japanese.vocabulary.studystats.util.KstClock
import com.japanese.vocabulary.test.ApiBaseIntegrationTest
import com.japanese.vocabulary.test.fixtures.TestFlashcardBuilder
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.test.fixtures.TestWordBuilder
import com.japanese.vocabulary.user.entity.UserEntity
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import java.time.Duration
import java.time.Instant

@AutoConfigureMockMvc
class StudyScheduleControllerTest : ApiBaseIntegrationTest() {

    @Autowired private lateinit var mockMvc: MockMvc
    @Autowired private lateinit var objectMapper: ObjectMapper
    @Autowired private lateinit var jwtUtil: JwtUtil
    @Autowired private lateinit var kstClock: KstClock
    @Autowired private lateinit var flashcardRepository: FlashcardRepository

    private fun newUser(): UserEntity = TestUserBuilder(entityManager).build()

    private fun newCard(user: UserEntity, dueAt: Instant = clock.instant(), japanese: String? = null): FlashcardEntity {
        val word = TestWordBuilder(entityManager).forUser(user).let {
            if (japanese != null) it.withJapaneseText(japanese) else it
        }.build()
        return TestFlashcardBuilder(entityManager, clock).forUser(user).ofWord(word).dueAt(dueAt).build()
    }

    private fun bearer(user: UserEntity): String = "Bearer ${jwtUtil.generateToken(user.id!!, user.username)}"

    private fun schedule(user: UserEntity, dailyTarget: Int): StudyScheduleResponse {
        val body = mockMvc.get("/api/study-schedule") {
            header("Authorization", bearer(user))
            param("dailyTarget", dailyTarget.toString())
        }.andExpect { status { isOk() } }.andReturn().response.contentAsString
        return objectMapper.readValue(body, StudyScheduleResponse::class.java)
    }

    /** [day] 일차 학습일이 끝나기 [before] 전 순간. */
    private fun beforeEndOf(day: Long, before: Duration = Duration.ofMinutes(1)): Instant =
        kstClock.endOf(kstClock.todayStudyDate().plusDays(day)).minus(before)

    @Test
    fun `summary previews the due queue head and days start today`() {
        val me = newUser()
        val second = newCard(me, dueAt = clock.instant().minusSeconds(60), japanese = "眩しい")
        val first = newCard(me, dueAt = clock.instant().minusSeconds(120), japanese = "手放す")
        val third = newCard(me, dueAt = clock.instant(), japanese = "確かめる")
        newCard(me, dueAt = clock.instant())
        newCard(me, dueAt = clock.instant().plusSeconds(60))
        newCard(newUser())

        val response = schedule(me, dailyTarget = 30)

        assertThat(response.dueToday).isEqualTo(4)
        assertThat(response.totalCards).isEqualTo(5)
        assertThat(response.previewWords.map { it.wordId })
            .containsExactly(first.wordId, second.wordId, third.wordId)
        assertThat(response.previewWords.map { it.japanese }).containsExactly("手放す", "眩しい", "確かめる")
        assertThat(response.dailyTarget).isEqualTo(30)
        assertThat(response.days).hasSize(30)
        assertThat(response.days.first().date).isEqualTo(kstClock.todayStudyDate().toString())
        assertThat(response.days.last().date).isEqualTo(kstClock.todayStudyDate().plusDays(29).toString())
    }

    @Test
    fun `scheduledDue buckets cards by study day and counts later today as tomorrow`() {
        val me = newUser()
        repeat(2) { newCard(me, dueAt = clock.instant().minus(Duration.ofDays(3))) }
        newCard(me, dueAt = clock.instant())
        newCard(me, dueAt = clock.instant().plusSeconds(60))
        newCard(me, dueAt = beforeEndOf(1))
        newCard(me, dueAt = beforeEndOf(1, before = Duration.ZERO))
        newCard(me, dueAt = beforeEndOf(29))
        newCard(me, dueAt = beforeEndOf(30))

        val days = schedule(me, dailyTarget = 0).days

        assertThat(days[0].scheduledDue).isEqualTo(3)
        assertThat(days[1].scheduledDue).isEqualTo(2)
        assertThat(days[2].scheduledDue).isEqualTo(1)
        assertThat(days[29].scheduledDue).isEqualTo(1)
        assertThat(days.sumOf { it.scheduledDue }).isEqualTo(7)
        assertThat(days.map { it.simulatedReview }).containsOnly(0)
    }

    @Test
    fun `simulation reviews at most dailyTarget cards and carries the rest over`() {
        val me = newUser()
        repeat(5) { newCard(me, dueAt = clock.instant().minusSeconds(60)) }

        val days = schedule(me, dailyTarget = 2).days

        assertThat(days[0].simulatedReview).isEqualTo(2)
        assertThat(days[1].simulatedReview).isEqualTo(2)
        assertThat(days.map { it.simulatedReview }).allMatch { it <= 2 }
    }

    @Test
    fun `cards rated good come back later in the forecast`() {
        val me = newUser()
        newCard(me, dueAt = clock.instant())

        val days = schedule(me, dailyTarget = 10).days

        // 새 카드: 오늘 GOOD 이면 learning 단계(10분)라 내일 다시 나오고, 그다음은 며칠 뒤다.
        assertThat(days[0].simulatedReview).isEqualTo(1)
        assertThat(days[1].simulatedReview).isEqualTo(1)
        assertThat(days.subList(2, 5).map { it.simulatedReview }).containsOnly(0)
        assertThat(days.sumOf { it.simulatedReview }).isGreaterThan(2)
    }

    @Test
    fun `simulation does not touch stored flashcards`() {
        val me = newUser()
        val card = newCard(me, dueAt = clock.instant())
        val before = flashcardRepository.findById(card.id!!).get().let { it.due to it.fsrsCardJson }

        schedule(me, dailyTarget = 100)
        entityManager.clear()

        val after = flashcardRepository.findById(card.id!!).get().let { it.due to it.fsrsCardJson }
        assertThat(after).isEqualTo(before)
    }

    @Test
    fun `rejects dailyTarget outside 0 to 100`() {
        val me = newUser()
        for (value in listOf("-1", "101", "invalid")) {
            mockMvc.get("/api/study-schedule") {
                header("Authorization", bearer(me))
                param("dailyTarget", value)
            }.andExpect { status { isBadRequest() } }
        }
        mockMvc.get("/api/study-schedule") {
            header("Authorization", bearer(me))
        }.andExpect { status { isBadRequest() } }
    }
}
