package com.japanese.vocabulary.notification

import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.notification.service.AnalysisNotificationSubscriptions
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.songanalysis.repository.SongAnalysisWorkRepository
import com.japanese.vocabulary.test.ApiAfterCommitListenerTest
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.ninjasquad.springmockk.SpykBean
import io.mockk.clearMocks
import io.mockk.every
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.data.redis.RedisConnectionFailureException
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post
import java.time.Instant
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

@AutoConfigureMockMvc
class AnalysisNotificationControllerTest : ApiAfterCommitListenerTest() {
    @Autowired private lateinit var mockMvc: MockMvc
    @Autowired private lateinit var jwtUtil: JwtUtil
    @Autowired private lateinit var works: SongAnalysisWorkRepository
    @SpykBean private lateinit var subscriptions: AnalysisNotificationSubscriptions

    private data class Fixture(val userId: Long, val token: String, val songId: Long, val lyricId: Long, val workId: Long)

    @BeforeEach
    fun resetSubscriptionsSpy() = clearMocks(subscriptions, answers = true, recordedCalls = true)

    private fun fixture(status: SongAnalysisWorkStatus = SongAnalysisWorkStatus.RUNNING): Fixture = inTx {
        val user = TestUserBuilder(entityManager).build()
        val song = TestSongBuilder(entityManager).build()
        val lyric = LyricEntity(songId = song.id!!, lyricType = LyricType.PLAIN, rawContent = emptyList())
        entityManager.persist(lyric)
        song.activeLyricId = lyric.id
        val work = SongAnalysisWorkEntity(
            rawTitle = song.title, rawArtist = song.artist,
            triggerSource = SongAnalysisTriggerSource.USER_APP,
            songId = song.id, lyricId = lyric.id, status = status,
        )
        entityManager.persist(work)
        Fixture(user.id!!, "Bearer ${jwtUtil.generateToken(user.id!!, user.username)}", song.id!!, lyric.id!!, work.id!!)
    }

    private fun update(f: Fixture, enabled: Boolean) = mockMvc.post("/api/songs/${f.songId}/analysis-notifications") {
        header("Authorization", f.token)
        contentType = MediaType.APPLICATION_JSON
        content = """{"enabled":$enabled}"""
    }

    @Test
    fun `subscribes idempotently with TTL and cancellation only removes current user`() {
        val f = fixture()
        repeat(2) {
            update(f, true).andExpect {
                status { isOk() }
                jsonPath("$.songId") { value(f.songId) }
                jsonPath("$.workId") { value(f.workId) }
                jsonPath("$.enabled") { value(true) }
            }
        }
        val key = "analysis:notifications:${f.workId}"
        assertThat(redisTemplate.opsForSet().members(key)).containsExactly(f.userId.toString())
        assertThat(redisTemplate.getExpire(key)).isBetween(86_390L, 86_400L)
        subscriptions.subscribe(f.workId, 999L)
        repeat(2) { update(f, false).andExpect { status { isOk() }; jsonPath("$.enabled") { value(false) } } }
        assertThat(subscriptions.consume(f.workId)).containsExactly(999L)
        assertThat(subscriptions.consume(f.workId)).isEmpty()
        assertThat(redisTemplate.hasKey(key)).isFalse()
    }

    @Test
    fun `completed work is a no-op and failed or absent work is a conflict`() {
        val completed = fixture(SongAnalysisWorkStatus.COMPLETED)
        update(completed, true).andExpect { status { isOk() }; jsonPath("$.enabled") { value(false) } }
        assertThat(subscriptions.consume(completed.workId)).isEmpty()
        update(fixture(SongAnalysisWorkStatus.FAILED), true).andExpect { status { isConflict() } }
        val absent = fixture()
        inTx { works.deleteById(absent.workId) }
        update(absent, true).andExpect { status { isConflict() } }
        update(absent.copy(songId = 999999), true).andExpect { status { isNotFound() } }
    }

    @Test
    fun `selects latest work for active lyric and never replacement lyric`() {
        val f = fixture()
        val latestId = inTx {
            val song = entityManager.find(SongEntity::class.java, f.songId)
            val replacement = LyricEntity(songId = f.songId, lyricType = LyricType.PLAIN, rawContent = emptyList())
            entityManager.persist(replacement)
            fun work(lyricId: Long) = SongAnalysisWorkEntity(
                rawTitle = song.title, rawArtist = song.artist, songId = f.songId, lyricId = lyricId,
                triggerSource = SongAnalysisTriggerSource.ADMIN,
            ).also { entityManager.persist(it) }
            val latest = work(f.lyricId)
            work(replacement.id!!)
            // Same createdAt verifies the id tie-breaker, independently of auditing timestamps.
            entityManager.flush()
            entityManager.createQuery("UPDATE SongAnalysisWorkEntity w SET w.createdAt = :now WHERE w.songId = :songId")
                .setParameter("now", clock.instant()).setParameter("songId", f.songId).executeUpdate()
            latest.id!!
        }
        update(f, true).andExpect { status { isOk() }; jsonPath("$.workId") { value(latestId) } }
        assertThat(subscriptions.consume(f.workId)).isEmpty()
        assertThat(subscriptions.consume(latestId)).containsExactly(f.userId)
    }

    @Test
    fun `requires authentication and explicit enabled and reports Redis failure`() {
        val f = fixture()
        mockMvc.post("/api/songs/${f.songId}/analysis-notifications") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"enabled":true}"""
        }.andExpect { status { isUnauthorized() } }
        for (body in listOf("{}", """{"enabled":null}""")) {
            mockMvc.post("/api/songs/${f.songId}/analysis-notifications") {
                header("Authorization", f.token)
                contentType = MediaType.APPLICATION_JSON
                content = body
            }.andExpect { status { isBadRequest() } }
        }
        every { subscriptions.subscribe(f.workId, f.userId) } throws RedisConnectionFailureException("test failure")
        update(f, true).andExpect { status { isServiceUnavailable() } }
        assertThat(subscriptions.consume(f.workId)).isEmpty()
    }

    @Test
    fun `completion waits until Redis registration finishes`() {
        val f = fixture()
        val registering = CountDownLatch(1)
        val releaseRegistration = CountDownLatch(1)
        val completionStarted = CountDownLatch(1)
        val completionLocked = CountDownLatch(1)
        every { subscriptions.subscribe(f.workId, f.userId) } answers {
            registering.countDown()
            check(releaseRegistration.await(10, TimeUnit.SECONDS))
            callOriginal()
        }
        val executor = Executors.newFixedThreadPool(2)
        try {
            val registration = executor.submit {
                update(f, true).andExpect { status { isOk() }; jsonPath("$.enabled") { value(true) } }
            }
            assertThat(registering.await(10, TimeUnit.SECONDS)).isTrue()
            val completion = executor.submit<List<Long>> {
                inTx {
                    completionStarted.countDown()
                    val work = works.findByIdForUpdate(f.workId)!!
                    completionLocked.countDown()
                    work.markCompleted(Instant.now())
                }
                subscriptions.consume(f.workId)
            }
            assertThat(completionStarted.await(10, TimeUnit.SECONDS)).isTrue()
            assertThat(completionLocked.await(200, TimeUnit.MILLISECONDS)).isFalse()
            releaseRegistration.countDown()
            registration.get(10, TimeUnit.SECONDS)
            assertThat(completion.get(10, TimeUnit.SECONDS)).containsExactly(f.userId)
        } finally {
            releaseRegistration.countDown()
            executor.shutdownNow()
            executor.awaitTermination(10, TimeUnit.SECONDS)
        }
    }

    @Test
    fun `completion committed before registration returns disabled without a stranded subscription`() {
        val f = fixture()
        val locked = CountDownLatch(1)
        val finish = CountDownLatch(1)
        val started = CountDownLatch(1)
        val executor = Executors.newFixedThreadPool(2)
        try {
            val completion = executor.submit {
                inTx {
                    val work = works.findByIdForUpdate(f.workId)!!
                    locked.countDown()
                    check(finish.await(10, TimeUnit.SECONDS))
                    work.markCompleted(Instant.now())
                }
            }
            assertThat(locked.await(10, TimeUnit.SECONDS)).isTrue()
            val registration = executor.submit {
                started.countDown()
                update(f, true).andExpect { status { isOk() }; jsonPath("$.enabled") { value(false) } }
            }
            assertThat(started.await(10, TimeUnit.SECONDS)).isTrue()
            finish.countDown()
            completion.get(10, TimeUnit.SECONDS)
            registration.get(10, TimeUnit.SECONDS)
            assertThat(subscriptions.consume(f.workId)).isEmpty()
        } finally {
            finish.countDown()
            executor.shutdownNow()
            executor.awaitTermination(10, TimeUnit.SECONDS)
        }
    }
}
