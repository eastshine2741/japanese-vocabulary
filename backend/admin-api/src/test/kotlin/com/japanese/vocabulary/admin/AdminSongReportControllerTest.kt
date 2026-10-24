package com.japanese.vocabulary.admin

import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricMvSyncEntity
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
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.user.entity.UserEntity
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.ResultActionsDsl
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post

@AutoConfigureMockMvc
class AdminSongReportControllerTest : AdminBaseIntegrationTest() {

    @Test
    fun `lists reports by status newest first`() {
        val user = TestUserBuilder(entityManager).withUsername("reporter").build()
        val (song, _) = songWithLyric()
        val older = report(song, user)
        val newer = report(song, user)
        report(song, user, SongReportStatus.REJECTED)

        mockMvc.get("/admin/api/song-reports?status=PENDING") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content.length()") { value(2) }
            jsonPath("$.content[0].id") { value(newer.id!!.toInt()) }
            jsonPath("$.content[1].id") { value(older.id!!.toInt()) }
            jsonPath("$.content[0].songTitle") { value(song.title) }
            jsonPath("$.content[0].username") { value("reporter") }
            jsonPath("$.content[0].typeLabel") { value("단어 뜻이 틀려요") }
        }
    }

    @Test
    fun `detail carries the current active lyric line`() {
        val (song, lyric) = songWithLyric()
        val report = report(song, TestUserBuilder(entityManager).build())

        mockMvc.get("/admin/api/song-reports/${report.id}") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isOk() }
            jsonPath("$.target.surface") { value("好き") }
            jsonPath("$.suggestion") { value("사랑") }
            jsonPath("$.context.song.id") { value(song.id!!.toInt()) }
            jsonPath("$.context.reportLyricId") { value(lyric.id!!.toInt()) }
            jsonPath("$.context.activeLyricId") { value(lyric.id!!.toInt()) }
            jsonPath("$.context.line.text") { value("君が好き") }
            jsonPath("$.context.line.tokens.length()") { value(3) }
        }
    }

    @Test
    fun `approve applies edits records changes and regenerates word candidates`() {
        val (song, lyric) = songWithLyric()
        val report = report(song, TestUserBuilder(entityManager).build())
        val body = mapOf(
            "note" to "고침",
            "changes" to listOf(
                mapOf(
                    "op" to "REPLACE_LINE_TOKENS",
                    "lineIndex" to 0,
                    "tokens" to listOf(
                        token("君が", "君", "きみが", PartOfSpeech.PRONOUN, 0, 2, "너가"),
                        token("好き", "好き", "スキ", PartOfSpeech.NA_ADJECTIVE, 2, 4, "좋아함"),
                    ),
                ),
                mapOf("op" to "SET_TOKEN_MEANING", "lineIndex" to 0, "charStart" to 2, "charEnd" to 4, "value" to "사랑"),
                mapOf("op" to "SET_YOUTUBE_URL", "value" to "https://youtu.be/abcdefghijk"),
            ),
        )

        approve(report, body).andExpect {
            status { isOk() }
            jsonPath("$.status") { value("APPROVED") }
            jsonPath("$.reviewNote") { value("고침") }
            jsonPath("$.reviewChanges.length()") { value(3) }
            jsonPath("$.reviewChanges[0].field") { value("lyric.line.tokens") }
            jsonPath("$.reviewChanges[0].before.length()") { value(3) }
            jsonPath("$.reviewChanges[1].field") { value("lyric.token.koreanText") }
            jsonPath("$.reviewChanges[1].locator.lyricId") { value(lyric.id!!.toInt()) }
            jsonPath("$.reviewChanges[1].locator.charStart") { value(2) }
            jsonPath("$.reviewChanges[1].before") { value("좋아함") }
            jsonPath("$.reviewChanges[1].after") { value("사랑") }
            jsonPath("$.reviewChanges[2].after") { value("https://www.youtube.com/watch?v=abcdefghijk") }
            jsonPath("$.context.line.tokens[1].koreanText") { value("사랑") }
        }

        entityManager.flush()
        entityManager.clear()
        val saved = entityManager.find(LyricEntity::class.java, lyric.id)
        val tokens = saved.analyzedContent!!.single().tokens
        assertThat(tokens.map { it.surface }).containsExactly("君が", "好き")
        assertThat(tokens[0].reading).isEqualTo("キミガ")
        assertThat(tokens[1].koreanText).isEqualTo("사랑")
        assertThat(saved.wordCandidates!!.candidates.map { it.koreanText }).contains("사랑").doesNotContain("좋아함")
        assertThat(entityManager.find(SongEntity::class.java, song.id).youtubeUrl).isEqualTo("https://www.youtube.com/watch?v=abcdefghijk")
        // 새 MV 에 맞춘 줄 시각을 다시 계산하도록 대기열에 들어간다.
        val syncs = entityManager.createQuery("SELECT s FROM LyricMvSyncEntity s", LyricMvSyncEntity::class.java).resultList
        assertThat(syncs.map { it.lyricId to it.youtubeVideoId }).containsExactly(lyric.id!! to "abcdefghijk")
        val reviewed = entityManager.find(SongReportEntity::class.java, report.id)
        assertThat(reviewed.status).isEqualTo(SongReportStatus.APPROVED)
        assertThat(reviewed.reviewedAt).isNotNull()
        assertThat(reviewed.reviewChanges!!.map { it.field })
            .containsExactly("lyric.line.tokens", "lyric.token.koreanText", "song.youtubeUrl")
    }

    @Test
    fun `approve with no changes only records the note`() {
        val (song, _) = songWithLyric()
        val report = report(song, TestUserBuilder(entityManager).build())

        approve(report, mapOf("changes" to emptyList<Any>(), "note" to "다른 제보에서 반영")).andExpect {
            status { isOk() }
            jsonPath("$.status") { value("APPROVED") }
            jsonPath("$.reviewChanges.length()") { value(0) }
        }
    }

    @Test
    fun `invariant violation applies nothing`() {
        val (song, lyric) = songWithLyric()
        val report = report(song, TestUserBuilder(entityManager).build())
        val body = mapOf(
            "changes" to listOf(
                mapOf("op" to "SET_TOKEN_MEANING", "lineIndex" to 0, "charStart" to 2, "charEnd" to 4, "value" to "사랑"),
                mapOf(
                    "op" to "REPLACE_LINE_TOKENS",
                    "lineIndex" to 0,
                    "tokens" to listOf(token("君", "君", "キミ", PartOfSpeech.PRONOUN, 0, 2, "너")),
                ),
            ),
        )

        approve(report, body).andExpect {
            status { isBadRequest() }
            jsonPath("$.error") { value("bad_request") }
        }

        assertThat(lyric.analyzedContent!!.single().tokens[2].koreanText).isEqualTo("좋아함")
        assertThat(lyric.analyzedContent!!.single().tokens).hasSize(3)
        assertThat(report.status).isEqualTo(SongReportStatus.PENDING)
        assertThat(report.reviewChanges).isNull()
    }

    @Test
    fun `changing line text without fixing its tokens is rejected`() {
        val (song, _) = songWithLyric()
        val report = report(song, TestUserBuilder(entityManager).build())

        approve(report, mapOf("changes" to listOf(mapOf("op" to "SET_LINE_TEXT", "lineIndex" to 0, "value" to "あなたが好き"))))
            .andExpect { status { isBadRequest() } }
    }

    @Test
    fun `reviewing a non-pending report is a conflict`() {
        val (song, _) = songWithLyric()
        val report = report(song, TestUserBuilder(entityManager).build(), SongReportStatus.REJECTED)

        approve(report, mapOf("changes" to emptyList<Any>())).andExpect {
            status { isConflict() }
            jsonPath("$.error") { value("SONG_REPORT_NOT_PENDING") }
        }
        mockMvc.post("/admin/api/song-reports/${report.id}/reject") {
            header("Authorization", "Bearer ${adminToken()}")
            contentType = MediaType.APPLICATION_JSON
            content = """{"note":"중복"}"""
        }.andExpect { status { isConflict() } }
    }

    @Test
    fun `reject records the note`() {
        val (song, _) = songWithLyric()
        val report = report(song, TestUserBuilder(entityManager).build())

        mockMvc.post("/admin/api/song-reports/${report.id}/reject") {
            header("Authorization", "Bearer ${adminToken()}")
            contentType = MediaType.APPLICATION_JSON
            content = """{"note":"원문과 같아요"}"""
        }.andExpect {
            status { isOk() }
            jsonPath("$.status") { value("REJECTED") }
            jsonPath("$.reviewNote") { value("원문과 같아요") }
            jsonPath("$.reviewedAt") { exists() }
        }
    }

    private fun approve(report: SongReportEntity, body: Map<String, Any?>): ResultActionsDsl =
        mockMvc.post("/admin/api/song-reports/${report.id}/approve") {
            header("Authorization", "Bearer ${adminToken()}")
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(body)
        }

    private fun token(surface: String, baseForm: String, reading: String, pos: PartOfSpeech, start: Int, end: Int, korean: String?) =
        mapOf(
            "surface" to surface,
            "baseForm" to baseForm,
            "reading" to reading,
            "baseFormReading" to reading,
            "partOfSpeech" to pos.name,
            "charStart" to start,
            "charEnd" to end,
            "koreanText" to korean,
        )

    private fun report(song: SongEntity, user: UserEntity, status: SongReportStatus = SongReportStatus.PENDING): SongReportEntity =
        SongReportEntity(
            userId = user.id!!,
            songId = song.id!!,
            lyricId = song.activeLyricId,
            type = SongReportType.WORD_MEANING,
            reportTarget = SongReportTarget(lineIndex = 0, charStart = 2, charEnd = 4, surface = "好き"),
            reportSuggestion = "사랑",
            status = status,
        ).also {
            entityManager.persist(it)
            entityManager.flush()
        }

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
