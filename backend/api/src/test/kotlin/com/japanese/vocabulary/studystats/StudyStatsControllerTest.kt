package com.japanese.vocabulary.studystats

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.studystats.dto.HeatmapResponse
import com.japanese.vocabulary.studystats.dto.HomeStatsResponse
import com.japanese.vocabulary.studystats.dto.ProfileStatsResponse
import com.japanese.vocabulary.studystats.entity.DailyStudySummaryEntity
import com.japanese.vocabulary.studystats.util.KstClock
import com.japanese.vocabulary.test.ApiBaseIntegrationTest
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.user.entity.UserEntity
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import java.time.LocalDate

@AutoConfigureMockMvc
class StudyStatsControllerTest : ApiBaseIntegrationTest() {

    @Autowired private lateinit var mockMvc: MockMvc
    @Autowired private lateinit var objectMapper: ObjectMapper
    @Autowired private lateinit var jwtUtil: JwtUtil
    @Autowired private lateinit var kstClock: KstClock

    private fun newUser(): UserEntity = TestUserBuilder(entityManager).build()
    private fun bearer(user: UserEntity): String = "Bearer ${jwtUtil.generateToken(user.id!!, user.username)}"
    private inline fun <reified T> readBody(json: String): T = objectMapper.readValue(json)

    private fun seedDay(user: UserEntity, date: LocalDate, reviewCount: Int = 1, freezeUsed: Boolean = false) {
        entityManager.persist(
            DailyStudySummaryEntity(
                userId = user.id!!,
                dateKst = date,
                reviewCount = reviewCount,
                freezeUsed = freezeUsed,
            ),
        )
        entityManager.flush()
    }

    @Nested
    inner class Home {

        @Test
        fun `empty user returns zero streak and seven none-or-today dots`() {
            val me = newUser()
            val today = kstClock.todayStudyDate()

            val body = mockMvc.get("/api/study-stats/home") {
                header("Authorization", bearer(me))
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            val resp = readBody<HomeStatsResponse>(body)
            assertThat(resp.currentStreak).isZero
            assertThat(resp.freezeCount).isZero
            assertThat(resp.weekDots).hasSize(7)
            val todayDot = resp.weekDots.single { it.date == today.toString() }
            assertThat(todayDot.status).isEqualTo("today")
            resp.weekDots.filter { it.date != today.toString() }
                .forEach { assertThat(it.status).isEqualTo("none") }
        }

        @Test
        fun `studied yesterday produces streak=1 and a studied dot`() {
            val me = newUser()
            val today = kstClock.todayStudyDate()
            val yesterday = today.minusDays(1)
            seedDay(me, yesterday, reviewCount = 5)

            val body = mockMvc.get("/api/study-stats/home") {
                header("Authorization", bearer(me))
            }.andReturn().response.contentAsString

            val resp = readBody<HomeStatsResponse>(body)
            assertThat(resp.currentStreak).isEqualTo(1)
            val yDot = resp.weekDots.firstOrNull { it.date == yesterday.toString() }
            if (yDot != null) {
                // Only assert when yesterday falls in this calendar week
                assertThat(yDot.status).isEqualTo("studied")
            }
        }

        @Test
        fun `freezeUsed row shows as freeze dot`() {
            val me = newUser()
            val today = kstClock.todayStudyDate()
            val target = today.minusDays(2)
            // Make sure the target date is within this week to assert the dot.
            if (target.isAfter(today.with(java.time.DayOfWeek.MONDAY).minusDays(1))) {
                seedDay(me, target, reviewCount = 0, freezeUsed = true)

                val body = mockMvc.get("/api/study-stats/home") {
                    header("Authorization", bearer(me))
                }.andReturn().response.contentAsString

                val resp = readBody<HomeStatsResponse>(body)
                val dot = resp.weekDots.single { it.date == target.toString() }
                assertThat(dot.status).isEqualTo("freeze")
            }
        }
    }

    @Nested
    inner class Profile {

        @Test
        fun `empty user gets zeros and default dailyGoal`() {
            val me = newUser()

            val body = mockMvc.get("/api/study-stats/profile") {
                header("Authorization", bearer(me))
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            val resp = readBody<ProfileStatsResponse>(body)
            assertThat(resp.currentStreak).isZero
            assertThat(resp.longestStreak).isZero
            assertThat(resp.totalStudyDays).isZero
            assertThat(resp.freezeCount).isZero
            assertThat(resp.dailyGoal).isEqualTo(100)
        }

        @Test
        fun `streak and longestStreak reflect seeded rows`() {
            val me = newUser()
            val today = kstClock.todayStudyDate()
            // Current run: yesterday, today
            seedDay(me, today)
            seedDay(me, today.minusDays(1))
            // Older run of 4 days, broken by gap
            (3..6).forEach { seedDay(me, today.minusDays(it.toLong())) }
            // Even older 1-day visit
            seedDay(me, today.minusDays(20))

            val body = mockMvc.get("/api/study-stats/profile") {
                header("Authorization", bearer(me))
            }.andReturn().response.contentAsString

            val resp = readBody<ProfileStatsResponse>(body)
            assertThat(resp.currentStreak).isEqualTo(2)
            assertThat(resp.longestStreak).isEqualTo(4)
            assertThat(resp.totalStudyDays).isEqualTo(7)
        }
    }

    @Nested
    inner class Heatmap {

        @Test
        fun `returns 112 days, today last, with row-based counts`() {
            val me = newUser()
            val today = kstClock.todayStudyDate()
            seedDay(me, today, reviewCount = 3)
            seedDay(me, today.minusDays(10), reviewCount = 0, freezeUsed = true)

            val body = mockMvc.get("/api/study-stats/heatmap") {
                header("Authorization", bearer(me))
            }.andReturn().response.contentAsString

            val resp = readBody<HeatmapResponse>(body)
            assertThat(resp.days).hasSize(112)
            assertThat(resp.days.last().date).isEqualTo(today.toString())
            val todayDay = resp.days.single { it.date == today.toString() }
            assertThat(todayDay.reviewCount).isEqualTo(3)
            val freezeDay = resp.days.single { it.date == today.minusDays(10).toString() }
            assertThat(freezeDay.freezeUsed).isTrue
            // A date that should be all-zero
            val emptyDay = resp.days.single { it.date == today.minusDays(5).toString() }
            assertThat(emptyDay.reviewCount).isZero
            assertThat(emptyDay.freezeUsed).isFalse
        }
    }
}
