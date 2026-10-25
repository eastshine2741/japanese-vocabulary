package com.japanese.vocabulary.admin

import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricMvSyncEntity
import com.japanese.vocabulary.song.entity.LyricMvSyncMethod
import com.japanese.vocabulary.song.entity.LyricMvSyncStatus
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.MvUnavailableReason
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.service.LyricMvSyncService
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.ResultActionsDsl
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post

@AutoConfigureMockMvc
class AdminLyricSyncAgentControllerTest : AdminBaseIntegrationTest() {

    @Autowired private lateinit var lyricMvSyncService: LyricMvSyncService

    @Test
    fun `agent claims the oldest pending sync with the lyric lines`() {
        val (song, lyric) = songWithLyric(VIDEO_ID)
        val sync = pending(lyric, VIDEO_ID)

        claim().andExpect {
            status { isOk() }
            jsonPath("$.id") { value(sync.id!!.toInt()) }
            jsonPath("$.attempt") { value(1) }
            jsonPath("$.songId") { value(song.id!!.toInt()) }
            jsonPath("$.youtubeVideoId") { value(VIDEO_ID) }
            jsonPath("$.lyricType") { value("SYNCED") }
            jsonPath("$.lines.length()") { value(2) }
            jsonPath("$.lines[1].startTimeMs") { value(5000) }
        }

        val claimed = reload(sync)
        assertThat(claimed.status).isEqualTo(LyricMvSyncStatus.RUNNING)
        assertThat(claimed.leaseUntil).isEqualTo(clock.instant().plus(LyricMvSyncService.LEASE))
    }

    @Test
    fun `claim returns no content when nothing waits`() {
        claim().andExpect { status { isNoContent() } }
    }

    @Test
    fun `a sync whose song moved to another MV is failed and the next one is claimed`() {
        val (_, lyric) = songWithLyric(VIDEO_ID)
        val stale = pending(lyric, "zzzzzzzzzzz")
        val current = pending(lyric, VIDEO_ID)

        claim().andExpect {
            status { isOk() }
            jsonPath("$.id") { value(current.id!!.toInt()) }
        }

        val skipped = reload(stale)
        assertThat(skipped.status).isEqualTo(LyricMvSyncStatus.FAILED)
        assertThat(skipped.errorMessage).isEqualTo(LyricMvSyncService.SUPERSEDED)
    }

    @Test
    fun `a FAILED pair queued again goes back to pending`() {
        val (song, lyric) = songWithLyric(VIDEO_ID)
        val failed = pending(lyric, VIDEO_ID).also {
            it.status = LyricMvSyncStatus.FAILED
            it.attempt = 3
            it.errorMessage = "superseded"
            entityManager.flush()
        }

        lyricMvSyncService.enqueue(song)

        val revived = reload(failed)
        assertThat(revived.status).isEqualTo(LyricMvSyncStatus.PENDING)
        assertThat(revived.attempt).isZero()
        assertThat(revived.errorMessage).isNull()
    }

    @Test
    fun `complete stores the timings`() {
        val (_, lyric) = songWithLyric(VIDEO_ID)
        val sync = pending(lyric, VIDEO_ID)
        claim().andExpect { status { isOk() } }

        complete(sync, attempt = 1, lines = listOf(0 to 7600L, 1 to 12600L)).andExpect { status { isNoContent() } }

        val done = reload(sync)
        assertThat(done.status).isEqualTo(LyricMvSyncStatus.COMPLETED)
        assertThat(done.method).isEqualTo(LyricMvSyncMethod.OFFSET)
        assertThat(done.lineTimings!!.map { it.startTimeMs }).containsExactly(7600L, 12600L)
        assertThat(done.confidence!!["verdict"]).isEqualTo("OK")
        assertThat(done.leaseUntil).isNull()
    }

    @Test
    fun `timings that miss a line or run backwards are rejected`() {
        val (_, lyric) = songWithLyric(VIDEO_ID)
        val sync = pending(lyric, VIDEO_ID)
        claim().andExpect { status { isOk() } }

        complete(sync, attempt = 1, lines = listOf(0 to 7600L)).andExpect { status { isBadRequest() } }
        complete(sync, attempt = 1, lines = listOf(0 to 12600L, 1 to 7600L)).andExpect { status { isBadRequest() } }
        assertThat(reload(sync).status).isEqualTo(LyricMvSyncStatus.RUNNING)
    }

    @Test
    fun `an expired lease is claimed again and the late result of the old claim is refused`() {
        val (_, lyric) = songWithLyric(VIDEO_ID)
        val sync = pending(lyric, VIDEO_ID)
        claim().andExpect { status { isOk() } }

        clock.advance(LyricMvSyncService.LEASE.plusSeconds(1))
        claim().andExpect {
            status { isOk() }
            jsonPath("$.attempt") { value(2) }
        }

        complete(sync, attempt = 1, lines = listOf(0 to 7600L, 1 to 12600L)).andExpect { status { isConflict() } }
        complete(sync, attempt = 2, lines = listOf(0 to 7600L, 1 to 12600L)).andExpect { status { isNoContent() } }
    }

    @Test
    fun `a song-level failure is final`() {
        val (_, lyric) = songWithLyric(VIDEO_ID)
        val sync = pending(lyric, VIDEO_ID)
        claim().andExpect { status { isOk() } }

        fail(sync, attempt = 1, retryable = false).andExpect { status { isNoContent() } }

        val failed = reload(sync)
        assertThat(failed.status).isEqualTo(LyricMvSyncStatus.FAILED)
        assertThat(failed.errorMessage).isEqualTo("SyncError: no line found")
    }

    @Test
    fun `the reason an MV could not be fetched is kept with the failure`() {
        val (_, lyric) = songWithLyric(VIDEO_ID)
        val sync = pending(lyric, VIDEO_ID)
        claim().andExpect { status { isOk() } }

        fail(sync, attempt = 1, retryable = false, mvUnavailable = "AGE_RESTRICTED").andExpect { status { isNoContent() } }

        assertThat(reload(sync).mvUnavailable).isEqualTo(MvUnavailableReason.AGE_RESTRICTED)
    }

    @Test
    fun `an agent-side failure waits before the retry and gives up after the last attempt`() {
        val (_, lyric) = songWithLyric(VIDEO_ID)
        val sync = pending(lyric, VIDEO_ID)

        for (attempt in 1 until LyricMvSyncService.MAX_ATTEMPTS) {
            claim().andExpect { status { isOk() } }
            fail(sync, attempt, retryable = true).andExpect { status { isNoContent() } }
            assertThat(reload(sync).status).isEqualTo(LyricMvSyncStatus.PENDING)
            claim().andExpect { status { isNoContent() } }
            clock.advance(LyricMvSyncService.RETRY_DELAY.plusSeconds(1))
        }
        claim().andExpect { status { isOk() } }
        fail(sync, LyricMvSyncService.MAX_ATTEMPTS, retryable = true).andExpect { status { isNoContent() } }

        assertThat(reload(sync).status).isEqualTo(LyricMvSyncStatus.FAILED)
    }

    @Test
    fun `agent token opens only the agent API and the admin token does not open it`() {
        mockMvc.get("/admin/api/songs") {
            header("Authorization", "Bearer $AGENT_TOKEN")
        }.andExpect { status { isForbidden() } }

        mockMvc.post("/admin/api/lyric-sync-agent/claim") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect { status { isForbidden() } }

        mockMvc.post("/admin/api/lyric-sync-agent/claim") {
            header("Authorization", "Bearer wrong-token")
        }.andExpect { status { isForbidden() } }
    }

    private fun claim(): ResultActionsDsl =
        mockMvc.post("/admin/api/lyric-sync-agent/claim") {
            header("Authorization", "Bearer $AGENT_TOKEN")
        }

    private fun complete(sync: LyricMvSyncEntity, attempt: Int, lines: List<Pair<Int, Long>>): ResultActionsDsl =
        mockMvc.post("/admin/api/lyric-sync-agent/syncs/${sync.id}/complete") {
            header("Authorization", "Bearer $AGENT_TOKEN")
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(
                mapOf(
                    "attempt" to attempt,
                    "method" to "OFFSET",
                    "lines" to lines.map { (index, ms) -> mapOf("index" to index, "startTimeMs" to ms) },
                    "confidence" to mapOf("verdict" to "OK", "within500ms" to 0.83),
                ),
            )
        }

    private fun fail(sync: LyricMvSyncEntity, attempt: Int, retryable: Boolean, mvUnavailable: String? = null): ResultActionsDsl =
        mockMvc.post("/admin/api/lyric-sync-agent/syncs/${sync.id}/fail") {
            header("Authorization", "Bearer $AGENT_TOKEN")
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(
                mapOf("attempt" to attempt, "message" to "SyncError: no line found", "retryable" to retryable, "mvUnavailable" to mvUnavailable),
            )
        }

    private fun reload(sync: LyricMvSyncEntity): LyricMvSyncEntity {
        entityManager.flush()
        entityManager.clear()
        return entityManager.find(LyricMvSyncEntity::class.java, sync.id)
    }

    private fun pending(lyric: LyricEntity, videoId: String): LyricMvSyncEntity =
        LyricMvSyncEntity(lyricId = lyric.id!!, youtubeVideoId = videoId).also {
            entityManager.persist(it)
            entityManager.flush()
        }

    private fun songWithLyric(videoId: String): Pair<SongEntity, LyricEntity> {
        val song = TestSongBuilder(entityManager).withYoutubeUrl("https://www.youtube.com/watch?v=$videoId").build()
        val lyric = LyricEntity(
            songId = song.id!!,
            lyricType = LyricType.SYNCED,
            rawContent = listOf(
                LyricLineData(index = 0, startTimeMs = 0, text = "夢ならば"),
                LyricLineData(index = 1, startTimeMs = 5000, text = "未だに"),
            ),
        )
        entityManager.persist(lyric)
        song.activeLyricId = lyric.id
        entityManager.flush()
        return song to lyric
    }

    companion object {
        private const val VIDEO_ID = "SX_ViT4Ra7k"
        private const val AGENT_TOKEN = "test-lyric-sync-agent-token"
    }
}
