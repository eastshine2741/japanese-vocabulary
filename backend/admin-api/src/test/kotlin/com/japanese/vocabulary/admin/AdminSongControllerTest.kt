package com.japanese.vocabulary.admin

import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import org.junit.jupiter.api.Test
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post

@AutoConfigureMockMvc
class AdminSongControllerTest : AdminBaseIntegrationTest() {
    @Test
    fun `authenticated admin can list songs and inspect song detail`() {
        val song = TestSongBuilder(entityManager)
            .withTitle("管理曲")
            .withArtist("管理歌手")
            .withYoutubeUrl("https://youtu.be/admin")
            .build()
        persistLyric(song.id!!)

        val token = adminToken()

        mockMvc.get("/admin/api/songs") {
            header("Authorization", "Bearer $token")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].title") { value("管理曲") }
        }

        mockMvc.get("/admin/api/songs/${song.id}") {
            header("Authorization", "Bearer $token")
        }.andExpect {
            status { isOk() }
            jsonPath("$.lyric.id") { value(lyricIdForSong(song.id!!).toInt()) }
        }
    }

    @Test
    fun `authenticated admin can inspect song lyric`() {
        val song = TestSongBuilder(entityManager).build()
        persistLyric(song.id!!)

        mockMvc.get("/admin/api/songs/${song.id}/lyric") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isOk() }
            jsonPath("$.rawContent[0].text") { value("歌詞") }
        }
    }


    @Test
    fun `authenticated admin can trigger song reanalysis and see work metadata`() {
        val song = TestSongBuilder(entityManager)
            .withTitle("再解析曲")
            .withArtist("管理歌手")
            .build()
        persistLyric(song.id!!)

        mockMvc.post("/admin/api/songs/${song.id}/reanalysis") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isOk() }
            jsonPath("$.status") { value("PENDING") }
            jsonPath("$.triggerSource") { value("ADMIN") }
            jsonPath("$.songId") { value(song.id!!.toInt()) }
        }

        mockMvc.get("/admin/api/songs/${song.id}") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isOk() }
            jsonPath("$.activeReanalysisWork.status") { value("PENDING") }
            jsonPath("$.analysisWorks[0].triggerSource") { value("ADMIN") }
        }
    }

    @Test
    fun `authenticated admin reanalysis returns existing active blocker`() {
        val song = TestSongBuilder(entityManager)
            .withTitle("競合曲")
            .withArtist("管理歌手")
            .build()
        persistLyric(song.id!!)
        val blocker = SongAnalysisWorkEntity(
            rawTitle = song.title,
            rawArtist = song.artist,
            activeDedupKey = "existing-blocker",
            status = SongAnalysisWorkStatus.RUNNING,
            songId = song.id,
            triggerSource = SongAnalysisTriggerSource.USER_APP,
        )
        entityManager.persist(blocker)
        entityManager.flush()

        mockMvc.post("/admin/api/songs/${song.id}/reanalysis") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isOk() }
            jsonPath("$.id") { value(blocker.id!!.toInt()) }
            jsonPath("$.triggerSource") { value("USER_APP") }
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
        val song = entityManager.find(com.japanese.vocabulary.song.entity.SongEntity::class.java, songId)
        song.activeLyricId = lyric.id
        entityManager.flush()
        return lyric
    }

    private fun lyricIdForSong(songId: Long): Long {
        return entityManager
            .createQuery("SELECT l.id FROM LyricEntity l WHERE l.songId = :songId", Long::class.java)
            .setParameter("songId", songId)
            .singleResult
    }
}
