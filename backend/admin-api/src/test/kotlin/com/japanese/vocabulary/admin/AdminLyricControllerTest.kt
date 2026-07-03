package com.japanese.vocabulary.admin

import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import org.junit.jupiter.api.Test
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.test.web.servlet.get

@AutoConfigureMockMvc
class AdminLyricControllerTest : AdminBaseIntegrationTest() {
    @Test
    fun `authenticated admin can list lyrics`() {
        val song = TestSongBuilder(entityManager).build()
        persistLyric(song.id!!)

        mockMvc.get("/admin/api/lyrics") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].songId") { value(song.id!!.toInt()) }
            jsonPath("$.content[0].status") { doesNotExist() }
        }
    }

    @Test
    fun `authenticated admin can inspect lyric detail`() {
        val song = TestSongBuilder(entityManager).build()
        val lyric = persistLyric(song.id!!)

        mockMvc.get("/admin/api/lyrics/${lyric.id}") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isOk() }
            jsonPath("$.rawContent[0].text") { value("歌詞") }
        }
    }

    private fun persistLyric(songId: Long): LyricEntity {
        val lyric = LyricEntity(
            songId = songId,
            lyricType = LyricType.PLAIN,
            rawContent = listOf(LyricLineData(index = 0, startTimeMs = 0, text = "歌詞")),
        )
        entityManager.persist(lyric)
        entityManager.flush()
        return lyric
    }
}
