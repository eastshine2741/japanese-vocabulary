package com.japanese.vocabulary.studystats

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.studystats.dto.HeatmapResponse
import com.japanese.vocabulary.studystats.dto.HomeStatsResponse
import com.japanese.vocabulary.studystats.dto.ProfileStatsResponse
import com.japanese.vocabulary.studystats.dto.StudyCalendarResponse
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
import java.time.YearMonth

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
            assertThat(resp.weekDots.map { it.date })
                .containsExactlyElementsOf((6L downTo 0L).map { today.minusDays(it).toString() })
            assertThat(resp.weekDots.last().status).isEqualTo("today")
            assertThat(resp.weekDots.dropLast(1)).allSatisfy { assertThat(it.status).isEqualTo("none") }
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
            val yDot = resp.weekDots.single { it.date == yesterday.toString() }
            assertThat(yDot.status).isEqualTo("studied")
        }

        @Test
        fun `never studied - studiedToday and hasStudiedBefore are false`() {
            val me = newUser()

            val resp = readBody<HomeStatsResponse>(home(me))
            assertThat(resp.currentStreak).isZero
            assertThat(resp.studiedToday).isFalse
            assertThat(resp.hasStudiedBefore).isFalse
        }

        @Test
        fun `studied yesterday but not today - pending with hasStudiedBefore`() {
            val me = newUser()
            val today = kstClock.todayStudyDate()
            seedDay(me, today.minusDays(1))
            seedDay(me, today.minusDays(2))
            seedDay(me, today.minusDays(3))

            val resp = readBody<HomeStatsResponse>(home(me))
            assertThat(resp.currentStreak).isEqualTo(3)
            assertThat(resp.studiedToday).isFalse
            assertThat(resp.hasStudiedBefore).isTrue
        }

        @Test
        fun `studied today - streak includes today and studiedToday is true`() {
            val me = newUser()
            val today = kstClock.todayStudyDate()
            seedDay(me, today)
            seedDay(me, today.minusDays(1))

            val resp = readBody<HomeStatsResponse>(home(me))
            assertThat(resp.currentStreak).isEqualTo(2)
            assertThat(resp.studiedToday).isTrue
            assertThat(resp.hasStudiedBefore).isTrue
        }

        @Test
        fun `broken streak - zero streak but hasStudiedBefore stays true`() {
            val me = newUser()
            val today = kstClock.todayStudyDate()
            seedDay(me, today.minusDays(3))

            val resp = readBody<HomeStatsResponse>(home(me))
            assertThat(resp.currentStreak).isZero
            assertThat(resp.studiedToday).isFalse
            assertThat(resp.hasStudiedBefore).isTrue
        }

        @Test
        fun `only-today first study - studiedToday true and hasStudiedBefore false`() {
            val me = newUser()
            seedDay(me, kstClock.todayStudyDate())

            val resp = readBody<HomeStatsResponse>(home(me))
            assertThat(resp.currentStreak).isEqualTo(1)
            assertThat(resp.studiedToday).isTrue
            assertThat(resp.hasStudiedBefore).isFalse
        }

        @Test
        fun `freeze-only row today does not count as studiedToday`() {
            val me = newUser()
            seedDay(me, kstClock.todayStudyDate(), reviewCount = 0, freezeUsed = true)

            val resp = readBody<HomeStatsResponse>(home(me))
            assertThat(resp.studiedToday).isFalse
        }

        private fun home(user: UserEntity): String =
            mockMvc.get("/api/study-stats/home") {
                header("Authorization", bearer(user))
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

        @Test
        fun `freezeUsed row shows as freeze dot`() {
            val me = newUser()
            val today = kstClock.todayStudyDate()
            val target = today.minusDays(2)
            seedDay(me, target, reviewCount = 0, freezeUsed = true)

            val body = mockMvc.get("/api/study-stats/home") {
                header("Authorization", bearer(me))
            }.andReturn().response.contentAsString

            val resp = readBody<HomeStatsResponse>(body)
            val dot = resp.weekDots.single { it.date == target.toString() }
            assertThat(dot.status).isEqualTo("freeze")
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

        @Test
        fun `freeze days keep runs unbroken but are excluded from every count`() {
            val me = newUser()
            val today = kstClock.todayStudyDate()
            // Current run: today, freeze yesterday, studied 2 days ago → streak 2
            seedDay(me, today)
            seedDay(me, today.minusDays(1), reviewCount = 0, freezeUsed = true)
            seedDay(me, today.minusDays(2))
            // Older run: 3 studied + 1 freeze in the middle → length 3, not 4
            seedDay(me, today.minusDays(5))
            seedDay(me, today.minusDays(6), reviewCount = 0, freezeUsed = true)
            seedDay(me, today.minusDays(7))
            seedDay(me, today.minusDays(8))

            val body = mockMvc.get("/api/study-stats/profile") {
                header("Authorization", bearer(me))
            }.andReturn().response.contentAsString

            val resp = readBody<ProfileStatsResponse>(body)
            assertThat(resp.currentStreak).isEqualTo(2)
            assertThat(resp.longestStreak).isEqualTo(3)
            assertThat(resp.totalStudyDays).isEqualTo(5)
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

    @Nested
    inner class Calendar {

        private fun calendar(user: UserEntity, query: String = ""): StudyCalendarResponse =
            readBody(
                mockMvc.get("/api/study-stats/calendar$query") {
                    header("Authorization", bearer(user))
                }.andExpect { status { isOk() } }.andReturn().response.contentAsString,
            )

        @Test
        fun `first page covers three months up to today, densely`() {
            val me = newUser()
            val today = kstClock.todayStudyDate()
            seedDay(me, today, reviewCount = 4)

            val resp = calendar(me)
            val from = YearMonth.from(today).minusMonths(2).atDay(1)
            assertThat(resp.days.first().date).isEqualTo(from.toString())
            assertThat(resp.days.last().date).isEqualTo(today.toString())
            assertThat(resp.days).hasSize((today.toEpochDay() - from.toEpochDay() + 1).toInt())
            assertThat(resp.days.last().reviewCount).isEqualTo(4)
            assertThat(resp.nextBefore).isNull()
        }

        @Test
        fun `nextBefore pages back until the oldest record`() {
            val me = newUser()
            val thisMonth = YearMonth.from(kstClock.todayStudyDate())
            val old = thisMonth.minusMonths(7).atDay(15)
            seedDay(me, old, reviewCount = 9)

            val first = calendar(me)
            assertThat(first.nextBefore).isEqualTo(thisMonth.minusMonths(2).toString())

            val second = calendar(me, "?before=${first.nextBefore}")
            assertThat(second.days.first().date).isEqualTo(thisMonth.minusMonths(5).atDay(1).toString())
            assertThat(second.days.last().date).isEqualTo(thisMonth.minusMonths(2).atDay(1).minusDays(1).toString())
            assertThat(second.nextBefore).isEqualTo(thisMonth.minusMonths(5).toString())

            val third = calendar(me, "?before=${second.nextBefore}")
            assertThat(third.days.single { it.date == old.toString() }.reviewCount).isEqualTo(9)
            assertThat(third.nextBefore).isNull()
        }

        @Test
        fun `months is clamped and a future cursor stops at this month`() {
            val me = newUser()
            val today = kstClock.todayStudyDate()

            val resp = calendar(me, "?before=${YearMonth.from(today).plusMonths(5)}&months=1")
            assertThat(resp.days.first().date).isEqualTo(YearMonth.from(today).atDay(1).toString())
            assertThat(resp.days.last().date).isEqualTo(today.toString())

            val wide = calendar(me, "?months=100")
            assertThat(wide.days.first().date).isEqualTo(YearMonth.from(today).minusMonths(11).atDay(1).toString())
        }
    }
}
