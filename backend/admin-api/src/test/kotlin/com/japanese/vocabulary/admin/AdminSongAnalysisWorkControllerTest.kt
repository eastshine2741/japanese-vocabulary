package com.japanese.vocabulary.admin

import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import org.junit.jupiter.api.Test
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.test.web.servlet.get

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
            jsonPath("$.stageTimings") { doesNotExist() }
        }
    }

    private fun persistWork(songId: Long): SongAnalysisWorkEntity {
        val work = SongAnalysisWorkEntity(
            rawTitle = "管理曲",
            rawArtist = "管理歌手",
            triggerSource = SongAnalysisTriggerSource.USER_APP,
            status = SongAnalysisWorkStatus.PENDING,
        )
        work.songId = songId
        entityManager.persist(work)
        entityManager.flush()
        return work
    }
}
