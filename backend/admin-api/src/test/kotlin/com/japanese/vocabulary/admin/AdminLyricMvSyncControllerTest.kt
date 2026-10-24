package com.japanese.vocabulary.admin

import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricMvSyncEntity
import com.japanese.vocabulary.song.entity.LyricMvSyncMethod
import com.japanese.vocabulary.song.entity.LyricMvSyncStatus
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.model.LyricLineTiming
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import org.junit.jupiter.api.Test
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.test.web.servlet.get

@AutoConfigureMockMvc
class AdminLyricMvSyncControllerTest : AdminBaseIntegrationTest() {

    @Test
    fun `list filters by verdict and marks whether the app uses the row`() {
        val (_, lyric) = songWithLyric(VIDEO_ID)
        val low = completed(lyric, VIDEO_ID, verdict = "LOW")
        completed(lyric, "zzzzzzzzzzz", verdict = "OK")

        mockMvc.get("/admin/api/lyric-mv-syncs?verdict=LOW") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isOk() }
            jsonPath("$.totalElements") { value(1) }
            jsonPath("$.content[0].id") { value(low.id!!.toInt()) }
            jsonPath("$.content[0].title") { value("Lemon") }
            jsonPath("$.content[0].verdict") { value("LOW") }
            jsonPath("$.content[0].anchoredCount") { value(1) }
            jsonPath("$.content[0].inUse") { value(true) }
        }

        mockMvc.get("/admin/api/lyric-mv-syncs?verdict=OK") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            jsonPath("$.content[0].inUse") { value(false) }
        }
    }

    @Test
    fun `detail pairs each lyric line with its original and MV time`() {
        val (_, lyric) = songWithLyric(VIDEO_ID)
        val sync = completed(lyric, VIDEO_ID, verdict = "OK")

        mockMvc.get("/admin/api/lyric-mv-syncs/${sync.id}") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isOk() }
            jsonPath("$.summary.method") { value("OFFSET") }
            jsonPath("$.confidence.within500ms") { value(0.83) }
            jsonPath("$.lines.length()") { value(2) }
            jsonPath("$.lines[1].text") { value("未だに") }
            jsonPath("$.lines[1].originalStartTimeMs") { value(5000) }
            jsonPath("$.lines[1].syncedStartTimeMs") { value(12600) }
        }
    }

    @Test
    fun `agent token cannot read the admin sync pages`() {
        mockMvc.get("/admin/api/lyric-mv-syncs") {
            header("Authorization", "Bearer test-lyric-sync-agent-token")
        }.andExpect { status { isForbidden() } }
    }

    private fun completed(lyric: LyricEntity, videoId: String, verdict: String): LyricMvSyncEntity =
        LyricMvSyncEntity(
            lyricId = lyric.id!!,
            youtubeVideoId = videoId,
            status = LyricMvSyncStatus.COMPLETED,
            attempt = 1,
            method = LyricMvSyncMethod.OFFSET,
            lineTimings = listOf(LyricLineTiming(0, 7600), LyricLineTiming(1, 12600)),
            confidence = mapOf("lines" to 2, "anchored" to 1, "within500ms" to 0.83, "verdict" to verdict),
            completedAt = clock.instant(),
        ).also {
            entityManager.persist(it)
            entityManager.flush()
        }

    private fun songWithLyric(videoId: String): Pair<SongEntity, LyricEntity> {
        val song = TestSongBuilder(entityManager)
            .withTitle("Lemon")
            .withYoutubeUrl("https://www.youtube.com/watch?v=$videoId")
            .build()
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
    }
}
