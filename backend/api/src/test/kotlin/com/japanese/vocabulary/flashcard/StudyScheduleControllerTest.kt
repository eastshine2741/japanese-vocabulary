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

    private fun newCard(
        user: UserEntity,
        dueAt: Instant = clock.instant(),
        japanese: String? = null,
        fsrsCardJson: String = "{}",
    ): FlashcardEntity {
        val word = TestWordBuilder(entityManager).forUser(user).let {
            if (japanese != null) it.withJapaneseText(japanese) else it
        }.build()
        return TestFlashcardBuilder(entityManager, clock).forUser(user).ofWord(word).dueAt(dueAt)
            .withFsrsCardJson(fsrsCardJson).build()
    }

    /** 열흘 전에 복습해 안정도 10일로 오늘 due 가 된, 기억 확률 약 90% 인 카드. */
    private fun newMatureCard(user: UserEntity): FlashcardEntity {
        val now = clock.instant()
        val json = """{"due":"$now","step":null,"state":"REVIEW","cardId":1,"stability":10.0,""" +
            """"difficulty":5.0,"lastReview":"${now.minus(Duration.ofDays(10))}"}"""
        return newCard(user, dueAt = now, fsrsCardJson = json)
    }

    private fun bearer(user: UserEntity): String = "Bearer ${jwtUtil.generateToken(user.id!!, user.username)}"

    private fun schedule(user: UserEntity): StudyScheduleResponse {
        val body = mockMvc.get("/api/study-schedule") {
            header("Authorization", bearer(user))
        }.andExpect { status { isOk() } }.andReturn().response.contentAsString
        return objectMapper.readValue(body, StudyScheduleResponse::class.java)
    }

    /** [day] 일차 학습일이 끝나기 [before] 전 순간. */
    private fun beforeEndOf(day: Long, before: Duration = Duration.ofMinutes(1)): Instant =
        kstClock.endOf(kstClock.todayStudyDate().plusDays(day)).minus(before)

    @Test
    fun `summary previews the due queue head and the forecast covers a year from today`() {
        val me = newUser()
        val second = newCard(me, dueAt = clock.instant().minusSeconds(60), japanese = "眩しい")
        val first = newCard(me, dueAt = clock.instant().minusSeconds(120), japanese = "手放す")
        val third = newCard(me, dueAt = clock.instant(), japanese = "確かめる")
        newCard(me, dueAt = clock.instant())
        newCard(me, dueAt = clock.instant().plusSeconds(60))
        newCard(newUser())

        val response = schedule(me)

        assertThat(response.dueToday).isEqualTo(4)
        assertThat(response.totalCards).isEqualTo(5)
        assertThat(response.previewWords.map { it.wordId })
            .containsExactly(first.wordId, second.wordId, third.wordId)
        assertThat(response.previewWords.map { it.japanese }).containsExactly("手放す", "眩しい", "確かめる")
        assertThat(response.days).hasSize(365)
        assertThat(response.days.first().date).isEqualTo(kstClock.todayStudyDate().toString())
        assertThat(response.days.last().date).isEqualTo(kstClock.todayStudyDate().plusDays(364).toString())
    }

    @Test
    fun `dueTomorrow counts cards due later today or tomorrow`() {
        val me = newUser()
        newCard(me, dueAt = clock.instant().minus(Duration.ofDays(3)))
        newCard(me, dueAt = clock.instant())
        newCard(me, dueAt = clock.instant().plusSeconds(60))
        newCard(me, dueAt = beforeEndOf(1))
        newCard(me, dueAt = beforeEndOf(1, before = Duration.ZERO))

        assertThat(schedule(me).dueTomorrow).isEqualTo(2)
    }

    @Test
    fun `reviewing daily keeps words remembered while skipping lets them fade`() {
        val me = newUser()
        repeat(10) { newMatureCard(me) }

        val days = schedule(me).days
        val reviewed = days.map { it.rememberedIfReviewed }
        val skipped = days.map { it.rememberedIfSkipped }

        assertThat(reviewed.first()).isEqualTo(skipped.first()).isEqualTo(9)
        assertThat(reviewed.drop(1)).allMatch { it >= 9 }
        assertThat(skipped.zipWithNext()).allMatch { (today, tomorrow) -> tomorrow <= today }
        assertThat(skipped.last()).isLessThan(reviewed.last() - 2)
    }

    @Test
    fun `cards never reviewed count as remembered only once the simulation reviews them`() {
        val me = newUser()
        newCard(me, dueAt = clock.instant())

        val days = schedule(me).days

        assertThat(days.map { it.rememberedIfSkipped }).containsOnly(0)
        assertThat(days[0].rememberedIfReviewed).isEqualTo(0)
        assertThat(days[1].rememberedIfReviewed).isEqualTo(1)
    }

    @Test
    fun `simulation does not touch stored flashcards`() {
        val me = newUser()
        val card = newMatureCard(me)
        entityManager.clear()
        val before = flashcardRepository.findById(card.id!!).get().let { it.due to it.fsrsCardJson }

        schedule(me)
        entityManager.clear()

        val after = flashcardRepository.findById(card.id!!).get().let { it.due to it.fsrsCardJson }
        assertThat(after).isEqualTo(before)
    }
}
