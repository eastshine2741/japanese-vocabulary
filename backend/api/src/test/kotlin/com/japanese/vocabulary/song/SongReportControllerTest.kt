package com.japanese.vocabulary.song

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.entity.SongReportEntity
import com.japanese.vocabulary.song.entity.SongReportStatus
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.song.model.SongReportTarget
import com.japanese.vocabulary.song.model.SongReportType
import com.japanese.vocabulary.song.model.Token
import com.japanese.vocabulary.test.ApiBaseIntegrationTest
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.user.entity.UserEntity
import io.mockk.every
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.ResultActionsDsl
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import java.time.Instant

@AutoConfigureMockMvc
class SongReportControllerTest : ApiBaseIntegrationTest() {

    @Autowired private lateinit var mockMvc: MockMvc
    @Autowired private lateinit var objectMapper: ObjectMapper
    @Autowired private lateinit var jwtUtil: JwtUtil

    @Test
    fun `types lists every report type in sheet order`() {
        val me = newUser()

        mockMvc.get("/api/song-reports/types") {
            header("Authorization", bearer(me))
        }.andExpect {
            status { isOk() }
            jsonPath("$.length()") { value(9) }
            jsonPath("$[0].type") { value("LYRIC_TEXT") }
            jsonPath("$[0].group") { value("LYRIC_LINE") }
            jsonPath("$[0].targetKind") { value("LINE") }
            jsonPath("$[3].type") { value("WORD_MEANING") }
            jsonPath("$[3].tokenPrompt") { value("어떤 단어인가요?") }
            jsonPath("$[6].type") { value("MV_OTHER_VERSION") }
            jsonPath("$[6].suggestionRequired") { value(false) }
            jsonPath("$[7].type") { value("MV_LENGTH_MISMATCH") }
            jsonPath("$[8].type") { value("MV_MISSING") }
        }
    }

    @Test
    fun `token report stores the surface and the active lyric`() {
        val me = newUser()
        val (song, lyric) = songWithLyric()

        val body = submit(me, song, mapOf("type" to "WORD_MEANING", "target" to mapOf("lineIndex" to 0, "charStart" to 2, "charEnd" to 4), "suggestion" to "  좋아함  "))
            .andExpect {
                status { isCreated() }
                jsonPath("$.status") { value("PENDING") }
            }.andReturn().response.contentAsString

        val report = entityManager.find(SongReportEntity::class.java, objectMapper.readTree(body)["id"].asLong())
        assertThat(report.userId).isEqualTo(me.id)
        assertThat(report.lyricId).isEqualTo(lyric.id)
        assertThat(report.type).isEqualTo(SongReportType.WORD_MEANING)
        assertThat(report.reportTarget).isEqualTo(SongReportTarget(lineIndex = 0, charStart = 2, charEnd = 4, surface = "好き"))
        assertThat(report.reportSuggestion).isEqualTo("좋아함")
    }

    @Test
    fun `unknown type is rejected`() {
        val (song, _) = songWithLyric()
        submit(newUser(), song, mapOf("type" to "NOPE", "suggestion" to "x")).andExpect {
            status { isBadRequest() }
            jsonPath("$.error") { value("SONG_REPORT_INVALID_TYPE") }
        }
    }

    @Test
    fun `line that is not in the lyric is rejected`() {
        val (song, _) = songWithLyric()
        submit(newUser(), song, mapOf("type" to "LYRIC_TEXT", "target" to mapOf("lineIndex" to 9), "suggestion" to "x")).andExpect {
            status { isBadRequest() }
            jsonPath("$.error") { value("SONG_REPORT_INVALID_TARGET") }
        }
    }

    @Test
    fun `token offsets that match no token are rejected`() {
        val (song, _) = songWithLyric()
        submit(newUser(), song, mapOf("type" to "FURIGANA", "target" to mapOf("lineIndex" to 0, "charStart" to 1, "charEnd" to 4), "suggestion" to "すき")).andExpect {
            status { isBadRequest() }
            jsonPath("$.error") { value("SONG_REPORT_INVALID_TARGET") }
        }
    }

    @Test
    fun `required suggestion cannot be blank`() {
        val (song, _) = songWithLyric()
        submit(newUser(), song, mapOf("type" to "TRANSLATION", "target" to mapOf("lineIndex" to 0), "suggestion" to "   ")).andExpect {
            status { isBadRequest() }
            jsonPath("$.error") { value("SONG_REPORT_SUGGESTION_REQUIRED") }
        }
    }

    @Test
    fun `MV report needs neither target nor suggestion`() {
        val (song, lyric) = songWithLyric()
        val body = submit(newUser(), song, mapOf("type" to "MV_WRONG_SONG"))
            .andExpect { status { isCreated() } }
            .andReturn().response.contentAsString

        val report = entityManager.find(SongReportEntity::class.java, objectMapper.readTree(body)["id"].asLong())
        assertThat(report.reportTarget).isNull()
        assertThat(report.reportSuggestion).isNull()
        assertThat(report.lyricId).isEqualTo(lyric.id)
    }

    @Test
    fun `MV report with a target is rejected`() {
        val (song, _) = songWithLyric()
        submit(newUser(), song, mapOf("type" to "MV_OTHER_VERSION", "target" to mapOf("lineIndex" to 0))).andExpect {
            status { isBadRequest() }
            jsonPath("$.error") { value("SONG_REPORT_INVALID_TARGET") }
        }
    }

    @Test
    fun `report on a missing song is 404`() {
        mockMvc.post("/api/songs/999999/reports") {
            header("Authorization", bearer(newUser()))
            contentType = MediaType.APPLICATION_JSON
            content = """{"type":"MV_WRONG_SONG"}"""
        }.andExpect { status { isNotFound() } }
    }

    @Test
    fun `contributors are distinct approved reporters in first-approval order`() {
        val (song, _) = songWithLyric()
        val (otherSong, _) = songWithLyric()
        every { objectStorageClient.enabled } returns true
        every { objectStorageClient.publicUrl(any()) } answers { "https://img.test/${firstArg<String>()}" }
        val early = newUser { withUsername("early"); withName("Early") }.also { it.profileImageKey = "avatars/early.jpg" }
        val late = newUser { withUsername("late") }
        val rejected = newUser { withUsername("rejected") }
        val pending = newUser { withUsername("pending") }
        val deleted = newUser { withUsername("gone") }.also { it.deletedAt = Instant.parse("2026-01-01T00:00:00Z") }
        val elsewhere = newUser { withUsername("elsewhere") }

        report(song, late, SongReportStatus.APPROVED, "2026-03-01T00:00:00Z")
        report(song, early, SongReportStatus.APPROVED, "2026-03-05T00:00:00Z")
        report(song, early, SongReportStatus.APPROVED, "2026-02-01T00:00:00Z")
        report(song, rejected, SongReportStatus.REJECTED, "2026-01-01T00:00:00Z")
        report(song, pending, SongReportStatus.PENDING, null)
        report(song, deleted, SongReportStatus.APPROVED, "2026-01-15T00:00:00Z")
        report(otherSong, elsewhere, SongReportStatus.APPROVED, "2026-01-01T00:00:00Z")

        mockMvc.get("/api/songs/${song.id}/contributors") {
            header("Authorization", bearer(early))
        }.andExpect {
            status { isOk() }
            jsonPath("$.count") { value(2) }
            jsonPath("$.contributors.length()") { value(2) }
            jsonPath("$.contributors[0].userId") { value(early.id!!.toInt()) }
            jsonPath("$.contributors[0].username") { value("early") }
            jsonPath("$.contributors[0].name") { value("Early") }
            jsonPath("$.contributors[0].profileImageUrl") { value("https://img.test/avatars/early.jpg") }
            jsonPath("$.contributors[1].profileImageUrl") { doesNotExist() }
            jsonPath("$.contributors[1].username") { value("late") }
        }
    }

    private fun submit(user: UserEntity, song: SongEntity, body: Map<String, Any?>): ResultActionsDsl =
        mockMvc.post("/api/songs/${song.id}/reports") {
            header("Authorization", bearer(user))
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(body)
        }

    private fun report(song: SongEntity, user: UserEntity, status: SongReportStatus, reviewedAt: String?) {
        entityManager.persist(
            SongReportEntity(
                userId = user.id!!,
                songId = song.id!!,
                lyricId = song.activeLyricId,
                type = SongReportType.MV_WRONG_SONG,
                reportTarget = null,
                reportSuggestion = null,
                status = status,
                reviewedAt = reviewedAt?.let(Instant::parse),
            ),
        )
        entityManager.flush()
    }

    private fun newUser(block: TestUserBuilder.() -> Unit = {}): UserEntity =
        TestUserBuilder(entityManager).apply(block).build()

    private fun bearer(user: UserEntity): String = "Bearer ${jwtUtil.generateToken(user.id!!, user.username)}"

    private fun songWithLyric(): Pair<SongEntity, LyricEntity> {
        val song = TestSongBuilder(entityManager).build()
        val lyric = LyricEntity(
            songId = song.id!!,
            lyricType = LyricType.PLAIN,
            rawContent = listOf(LyricLineData(index = 0, startTimeMs = null, text = "君が好き")),
            analyzedContent = listOf(
                AnalyzedLine(
                    index = 0,
                    koreanLyrics = "너를 좋아해",
                    tokens = listOf(
                        Token("君", "君", "キミ", "キミ", PartOfSpeech.PRONOUN, 0, 1, "너"),
                        Token("が", "が", "ガ", "ガ", PartOfSpeech.PARTICLE, 1, 2),
                        Token("好き", "好き", "スキ", "スキ", PartOfSpeech.NA_ADJECTIVE, 2, 4, "좋아함"),
                    ),
                ),
            ),
        )
        entityManager.persist(lyric)
        song.activeLyricId = lyric.id
        entityManager.flush()
        return song to lyric
    }
}
