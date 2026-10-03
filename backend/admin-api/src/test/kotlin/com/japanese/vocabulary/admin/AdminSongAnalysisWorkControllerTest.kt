package com.japanese.vocabulary.admin

import com.japanese.vocabulary.songanalysis.entity.SongAnalysisStageStatus
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStage
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStageEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import org.junit.jupiter.api.Test
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post

@AutoConfigureMockMvc
class AdminSongAnalysisWorkControllerTest : AdminBaseIntegrationTest() {
    @Test
    fun `authenticated admin can list song analysis work by status`() {
        val song = TestSongBuilder(entityManager)
            .withTitle("管理曲")
            .withArtist("管理歌手")
            .build()
        persistWork(song.id!!)

        mockMvc.get("/admin/api/song-analysis-works") {
            header("Authorization", "Bearer ${adminToken()}")
            param("status", "PENDING")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].rawTitle") { value("管理曲") }
            jsonPath("$.content[0].status") { value("PENDING") }
            jsonPath("$.content[0].youtubeUrl") { value("https://youtu.be/work-mv") }
            jsonPath("$.content[0].previousYoutubeUrl") { doesNotExist() }
        }
    }

    @Test
    fun `authenticated admin can inspect song analysis work detail`() {
        val song = TestSongBuilder(entityManager).build()
        val work = persistWork(song.id!!)

        mockMvc.get("/admin/api/song-analysis-works/${work.id}") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isOk() }
            jsonPath("$.status") { value("PENDING") }
            jsonPath("$.youtubeUrl") { value("https://youtu.be/work-mv") }
            jsonPath("$.previousYoutubeUrl") { doesNotExist() }
            jsonPath("$.stageTimings") { doesNotExist() }
            jsonPath("$.stages") { isEmpty() }
            jsonPath("$.resumable") { value(false) }
        }
    }

    @Test
    fun `detail lists stages with their failure and the stage output is readable`() {
        val song = TestSongBuilder(entityManager).build()
        val work = persistFailedAt(song.id!!, SongAnalysisWorkStage.ANALYZE_LYRICS)

        mockMvc.get("/admin/api/song-analysis-works/${work.id}") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isOk() }
            jsonPath("$.resumable") { value(true) }
            jsonPath("$.stages[0].stage") { value("FETCH_LYRICS") }
            jsonPath("$.stages[0].status") { value("COMPLETED") }
            jsonPath("$.stages[1].stage") { value("ANALYZE_LYRICS") }
            jsonPath("$.stages[1].status") { value("FAILED") }
            jsonPath("$.stages[1].errorClass") { value("java.lang.IllegalStateException") }
            jsonPath("$.stages[1].errorMessage") { value("IllegalStateException: bad answer") }
        }

        mockMvc.get("/admin/api/song-analysis-works/${work.id}/stages/FETCH_LYRICS/output") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isOk() }
            jsonPath("$.lines") { value(1) }
        }
    }

    @Test
    fun `admin can resume a failed work from its failed stage`() {
        val song = TestSongBuilder(entityManager).build()
        val work = persistFailedAt(song.id!!, SongAnalysisWorkStage.ANALYZE_LYRICS)

        mockMvc.post("/admin/api/song-analysis-works/${work.id}/resume") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isOk() }
            jsonPath("$.status") { value("PENDING") }
            jsonPath("$.currentStage") { value("ANALYZE_LYRICS") }
            jsonPath("$.errorCode") { doesNotExist() }
            jsonPath("$.stages[1].status") { value("PENDING") }
        }
    }

    @Test
    fun `resuming a work that is not failed is a conflict`() {
        val song = TestSongBuilder(entityManager).build()
        val work = persistWork(song.id!!)

        mockMvc.post("/admin/api/song-analysis-works/${work.id}/resume") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isConflict() }
            jsonPath("$.error") { value("SONG_ANALYSIS_WORK_NOT_RESUMABLE") }
        }
    }

    private fun persistFailedAt(songId: Long, failedStage: SongAnalysisWorkStage): SongAnalysisWorkEntity {
        val work = SongAnalysisWorkEntity(
            rawTitle = "失敗曲",
            rawArtist = "失敗歌手",
            triggerSource = SongAnalysisTriggerSource.USER_APP,
            status = SongAnalysisWorkStatus.FAILED,
            currentStage = failedStage,
            errorCode = "SONG_ANALYSIS_WORK_FAILED",
            errorMessage = "Song analysis failed",
        )
        work.songId = songId
        entityManager.persist(work)
        entityManager.persist(
            SongAnalysisWorkStageEntity(
                workId = work.id!!,
                stage = SongAnalysisWorkStage.FETCH_LYRICS,
                status = SongAnalysisStageStatus.COMPLETED,
                attempt = 1,
                output = """{"lines":1}""",
            ),
        )
        entityManager.persist(
            SongAnalysisWorkStageEntity(
                workId = work.id!!,
                stage = failedStage,
                status = SongAnalysisStageStatus.FAILED,
                attempt = 1,
                errorCode = "SONG_ANALYSIS_WORK_FAILED",
                errorClass = "java.lang.IllegalStateException",
                errorMessage = "IllegalStateException: bad answer",
            ),
        )
        entityManager.flush()
        return work
    }

    private fun persistWork(songId: Long): SongAnalysisWorkEntity {
        val work = SongAnalysisWorkEntity(
            rawTitle = "管理曲",
            rawArtist = "管理歌手",
            triggerSource = SongAnalysisTriggerSource.USER_APP,
            status = SongAnalysisWorkStatus.PENDING,
        )
        work.songId = songId
        work.youtubeUrl = "https://youtu.be/work-mv"
        entityManager.persist(work)
        entityManager.flush()
        return work
    }
}
