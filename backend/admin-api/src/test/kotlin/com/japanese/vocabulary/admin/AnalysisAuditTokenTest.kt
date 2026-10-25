package com.japanese.vocabulary.admin

import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import org.junit.jupiter.api.Test
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post

@AutoConfigureMockMvc
class AnalysisAuditTokenTest : AdminBaseIntegrationTest() {
    @Test
    fun `audit token reads analysis works and lyric detail`() {
        val song = TestSongBuilder(entityManager).build()
        val lyric = LyricEntity(
            songId = song.id!!,
            lyricType = LyricType.PLAIN,
            rawContent = listOf(LyricLineData(index = 0, startTimeMs = 0, text = "歌詞")),
        )
        entityManager.persist(lyric)
        entityManager.flush()

        mockMvc.get("/admin/api/song-analysis-works") {
            header("Authorization", "Bearer $AUDIT_TOKEN")
        }.andExpect { status { isOk() } }
        mockMvc.get("/admin/api/lyrics/${lyric.id}") {
            header("Authorization", "Bearer $AUDIT_TOKEN")
        }.andExpect {
            status { isOk() }
            jsonPath("$.rawContent[0].text") { value("歌詞") }
        }
    }

    @Test
    fun `audit token cannot act or read other admin pages`() {
        mockMvc.post("/admin/api/song-analysis-works/1/resume") {
            header("Authorization", "Bearer $AUDIT_TOKEN")
        }.andExpect { status { isForbidden() } }
        mockMvc.get("/admin/api/users") {
            header("Authorization", "Bearer $AUDIT_TOKEN")
        }.andExpect { status { isForbidden() } }
        mockMvc.get("/admin/api/lyric-sync-agent/jobs/next") {
            header("Authorization", "Bearer $AUDIT_TOKEN")
        }.andExpect { status { isForbidden() } }
    }

    companion object {
        private const val AUDIT_TOKEN = "test-analysis-audit-token"
    }
}
