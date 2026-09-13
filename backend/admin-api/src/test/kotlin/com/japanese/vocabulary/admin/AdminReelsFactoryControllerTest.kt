package com.japanese.vocabulary.admin

import com.japanese.vocabulary.admin.dto.reels.AdminReelsRenderRequest
import com.japanese.vocabulary.admin.dto.reels.AdminReelsVocabularyResponse
import com.japanese.vocabulary.admin.reels.AdminReelsRenderFailedException
import com.japanese.vocabulary.admin.reels.AdminReelsRenderService
import com.japanese.vocabulary.admin.reels.AdminReelsSourceCache
import com.japanese.vocabulary.admin.reels.AdminReelsSourceProperties
import com.japanese.vocabulary.admin.reels.FileAdminReelsSourceCache
import com.japanese.vocabulary.admin.reels.model.AdminReelsPromoData
import com.japanese.vocabulary.admin.reels.model.AdminReelsPromoLine
import com.japanese.vocabulary.admin.reels.model.AdminReelsPromoSong
import com.japanese.vocabulary.admin.reels.model.AdminReelsPromoToken
import com.japanese.vocabulary.admin.reels.model.AdminReelsRenderInput
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.song.model.Token
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.annotation.Primary
import org.springframework.http.MediaType
import org.springframework.mock.web.MockMultipartFile
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.multipart
import org.springframework.test.web.servlet.post
import java.nio.file.Files
import java.nio.file.Path

@AutoConfigureMockMvc
@Import(AdminReelsFactoryControllerTest.ReelsFactoryTestConfig::class)
class AdminReelsFactoryControllerTest : AdminBaseIntegrationTest() {
    @Autowired private lateinit var fakeRenderer: FakeReelsRenderService
    @Autowired private lateinit var sourceCache: AdminReelsSourceCache

    /** fake 렌더러는 컨텍스트에 하나뿐이라 앞 테스트가 남긴 입력을 지운다. */
    @BeforeEach
    fun resetRenderer() {
        fakeRenderer.lastInput = null
        fakeRenderer.failWith = null
    }

    @Test
    fun `reels factory lists candidates and exposes analyzed lines with editor limits`() {
        val song = TestSongBuilder(entityManager)
            .withTitle("Lemon")
            .withArtist("米津玄師")
            .withYoutubeUrl("https://youtu.be/SX_ViT4Ra7k")
            .build()
        // PLAIN 가사 — 타임스탬프가 없어도 에디터에서 고를 수 있어야 한다
        persistLyric(song.id!!, analyzed = true, lineCount = 4, missingTimingIndex = 2)

        mockMvc.get("/admin/api/reels-factory/songs") {
            header("Authorization", "Bearer ${adminToken()}")
            param("q", "lem")
        }.andExpect {
            status { isOk() }
            jsonPath("$.content[0].title") { value("Lemon") }
            jsonPath("$.content[0].hasAnalyzedLyrics") { value(true) }
            jsonPath("$.content[0].renderEligible") { value(true) }
        }

        mockMvc.get("/admin/api/reels-factory/songs/${song.id}") {
            header("Authorization", "Bearer ${adminToken()}")
        }.andExpect {
            status { isOk() }
            jsonPath("$.song.artist") { value("米津玄師") }
            jsonPath("$.lyricType") { value("PLAIN") }
            jsonPath("$.fps") { value(30) }
            jsonPath("$.lines[0].originalText") { value("歌詞0") }
            jsonPath("$.lines[0].recommendedVocabulary[0].japanese") { value("夢") }
            jsonPath("$.lines[0].recommendedVocabulary[0].partOfSpeechLabel") { value("명사") }
            jsonPath("$.lines[0].recommendedVocabulary[0].jlpt") { value("N5") }
            jsonPath("$.lines[2].startTimeMs") { doesNotExist() }
            jsonPath("$.lines[2].selectable") { value(true) }
            jsonPath("$.minLineCount") { value(4) }
            jsonPath("$.maxLineCount") { doesNotExist() }
            jsonPath("$.maxLyricsSpanMs") { value(60000) }
            jsonPath("$.maxVocabularyPerLine") { value(2) }
        }
    }

    @Test
    fun `reels factory render validates acknowledgement and renders editor data as given`() {
        val song = TestSongBuilder(entityManager)
            .withTitle("Lemon")
            .withArtist("米津玄師")
            .withYoutubeUrl("https://youtu.be/SX_ViT4Ra7k")
            .build()
        persistLyric(song.id!!, analyzed = true, lineCount = 7)
        val token = adminToken()
        uploadSource(token, song.id!!)

        mockMvc.post("/admin/api/reels-factory/render") {
            header("Authorization", "Bearer $token")
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(
                AdminReelsRenderRequest(
                    songId = song.id!!,
                    data = promoData(startFrames = listOf(0, 60, 120, 180), lyricsEndFrame = 240),
                    acknowledgeSourceRightsAndPlatformRisk = false,
                ),
            )
        }.andExpect {
            status { isBadRequest() }
            jsonPath("$.error") { value("bad_request") }
        }

        // 어드민이 찍은 타이밍·단어를 그대로 렌더한다 — DB 타임스탬프(2초 간격)와 달라도 상관없다
        val data = promoData(
            startFrames = listOf(45, 90, 200, 260, 400),
            lyricsEndFrame = 520,
            sourceStartFrame = 900,
            vocabulary = listOf(AdminReelsVocabularyResponse(japanese = "夢", reading = "ユメ", korean = "꿈", partOfSpeech = "NOUN", jlpt = "N5")),
        ).copy(song = AdminReelsPromoSong(title = "Lemon", artist = "米津玄師", artworkAsset = "", mvAsset = "http://localhost/mv?token=x"))
        mockMvc.post("/admin/api/reels-factory/render") {
            header("Authorization", "Bearer $token")
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(
                AdminReelsRenderRequest(songId = song.id!!, data = data, acknowledgeSourceRightsAndPlatformRisk = true),
            )
        }.andExpect {
            status { isOk() }
            header { string("Content-Type", "video/mp4") }
            header { string("Content-Disposition", "attachment; filename=\"kotonoha-reel-${song.id}.mp4\"") }
        }

        // 어드민이 올려 둔 파일을 렌더 스크립트에 그대로 넘긴다
        assertThat(fakeRenderer.lastInput?.source?.localPath)
            .isEqualTo(sourceCache.cached(song.id!!).toString())
        val rendered = requireNotNull(fakeRenderer.lastInput?.data)
        assertThat(rendered.sourceStartFrame).isEqualTo(900)
        assertThat(rendered.lyricLines.map { it.startFrame }).containsExactly(45, 90, 200, 260, 400)
        assertThat(rendered.lyricsEndFrame).isEqualTo(520)
        assertThat(rendered.lyricLines.first().vocabulary.single().japanese).isEqualTo("夢")
        // 클라이언트의 스트리밍 URL 은 버리고 렌더 스크립트가 mvAsset 을 채운다
        assertThat(rendered.song.mvAsset).isEmpty()
    }

    @Test
    fun `reels factory render failure returns json for mp4 accept header`() {
        val song = TestSongBuilder(entityManager)
            .withTitle("Lemon")
            .withArtist("米津玄師")
            .withYoutubeUrl("https://youtu.be/SX_ViT4Ra7k")
            .build()
        persistLyric(song.id!!, analyzed = true, lineCount = 4)
        val token = adminToken()
        uploadSource(token, song.id!!)
        fakeRenderer.failWith = AdminReelsRenderFailedException("boom")

        mockMvc.post("/admin/api/reels-factory/render") {
            header("Authorization", "Bearer $token")
            accept(MediaType.parseMediaType("video/mp4"))
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(
                AdminReelsRenderRequest(
                    songId = song.id!!,
                    data = promoData(startFrames = listOf(0, 60, 120, 180), lyricsEndFrame = 240),
                    acknowledgeSourceRightsAndPlatformRisk = true,
                ),
            )
        }.andExpect {
            status { isInternalServerError() }
            content { contentType(MediaType.APPLICATION_JSON) }
            jsonPath("$.error") { value("render_failed") }
        }
    }

    @Test
    fun `reels factory render rejects ineligible songs and invalid timelines`() {
        val noAnalysisSong = TestSongBuilder(entityManager).withYoutubeUrl("https://youtu.be/no-analysis").build()
        persistLyric(noAnalysisSong.id!!, analyzed = false, lineCount = 4)
        // MV 는 어드민이 올리므로 youtubeUrl 이 없어도 곡 자체는 eligible 이다
        val noSourceSong = TestSongBuilder(entityManager).withYoutubeUrl(null).build()
        persistLyric(noSourceSong.id!!, analyzed = true, lineCount = 4)
        val song = TestSongBuilder(entityManager).withYoutubeUrl("https://youtu.be/ok").build()
        persistLyric(song.id!!, analyzed = true, lineCount = 4)
        val token = adminToken()
        val valid = promoData(startFrames = listOf(0, 60, 120, 180), lyricsEndFrame = 240)

        renderExpectingBadRequest(token, noAnalysisSong.id!!, valid)
        // 분석은 됐지만 source 를 올리지 않음
        renderExpectingBadRequest(token, noSourceSong.id!!, valid)
        uploadSource(token, song.id!!)
        // 줄 수 부족
        renderExpectingBadRequest(token, song.id!!, promoData(startFrames = listOf(0, 60, 120), lyricsEndFrame = 240))
        // 시작 프레임이 단조 증가하지 않음
        renderExpectingBadRequest(token, song.id!!, promoData(startFrames = listOf(0, 120, 60, 180), lyricsEndFrame = 240))
        // 곡 순서를 어김
        renderExpectingBadRequest(token, song.id!!, valid.copy(lyricLines = valid.lyricLines.reversed().mapIndexed { i, line -> line.copy(startFrame = i * 60) }))
        // 끝이 마지막 줄보다 앞
        renderExpectingBadRequest(token, song.id!!, promoData(startFrames = listOf(0, 60, 120, 180), lyricsEndFrame = 180))
        // 첫 줄이 클립 시작보다 앞
        renderExpectingBadRequest(token, song.id!!, promoData(startFrames = listOf(-10, 60, 120, 180), lyricsEndFrame = 240))
        // 60초 상한
        renderExpectingBadRequest(token, song.id!!, promoData(startFrames = listOf(0, 60, 120, 180), lyricsEndFrame = 1801))
        // 줄당 단어 상한
        val threeWords = List(3) { AdminReelsVocabularyResponse(japanese = "夢$it", reading = "ユメ", korean = "꿈") }
        renderExpectingBadRequest(token, song.id!!, promoData(startFrames = listOf(0, 60, 120, 180), lyricsEndFrame = 240, vocabulary = threeWords))
        assertThat(fakeRenderer.lastInput).isNull()
    }

    @Test
    fun `reels factory source accepts uploaded mp4 and streams it with media token`() {
        val song = TestSongBuilder(entityManager)
            .withTitle("Lemon")
            .withArtist("米津玄師")
            .withYoutubeUrl("https://youtu.be/SX_ViT4Ra7k")
            .build()
        persistLyric(song.id!!, analyzed = true, lineCount = 7)
        val token = adminToken()

        // 아직 올린 게 없다
        mockMvc.get("/admin/api/reels-factory/songs/${song.id}/source") {
            header("Authorization", "Bearer $token")
        }.andExpect {
            status { isNotFound() }
        }

        // 확장자만 mp4 인 파일은 거절
        mockMvc.multipart("/admin/api/reels-factory/songs/${song.id}/source") {
            header("Authorization", "Bearer $token")
            file(MockMultipartFile("file", "mv.mp4", "video/mp4", "not an mp4 at all".toByteArray()))
        }.andExpect {
            status { isBadRequest() }
            jsonPath("$.error") { value("bad_request") }
        }
        assertThat(sourceCache.cached(song.id!!)).isNull()

        val mvPath = uploadSource(token, song.id!!)
        assertThat(mvPath).startsWith("/reels-factory/songs/${song.id}/mv?token=")
        assertThat(fakeRenderer.lastInput).isNull()
        val mediaToken = mvPath.substringAfter("token=")

        // 올린 뒤에는 다시 올리지 않고 경로만 받을 수 있다 (새 미디어 토큰)
        mockMvc.get("/admin/api/reels-factory/songs/${song.id}/source") {
            header("Authorization", "Bearer $token")
        }.andExpect {
            status { isOk() }
            jsonPath("$.mvPath") { value(org.hamcrest.Matchers.startsWith("/reels-factory/songs/${song.id}/mv?token=")) }
        }

        // 미디어 토큰만으로 스트리밍 — Authorization 헤더 없음
        mockMvc.get("/admin/api/reels-factory/songs/${song.id}/mv") {
            param("token", mediaToken)
        }.andExpect {
            status { isOk() }
            header { string("Content-Type", "video/mp4") }
            header { string("Accept-Ranges", "bytes") }
            content { bytes(FAKE_MP4) }
        }

        // Range 요청은 206 으로 잘라 준다
        mockMvc.get("/admin/api/reels-factory/songs/${song.id}/mv") {
            param("token", mediaToken)
            header("Range", "bytes=0-3")
        }.andExpect {
            status { isPartialContent() }
            header { string("Content-Range", "bytes 0-3/${FAKE_MP4.size}") }
            content { bytes(FAKE_MP4.copyOfRange(0, 4)) }
        }

        // 미디어 토큰은 다른 곡·어드민 토큰에는 안 통한다
        mockMvc.get("/admin/api/reels-factory/songs/${song.id!! + 1}/mv") {
            param("token", mediaToken)
        }.andExpect {
            status { isUnauthorized() }
        }
        mockMvc.get("/admin/api/reels-factory/songs/${song.id}/mv") {
            param("token", token)
        }.andExpect {
            status { isUnauthorized() }
        }
        // 어드민 토큰을 헤더에 붙여도 미디어 토큰이 없으면 안 된다 (query 파라미터 필수)
        mockMvc.get("/admin/api/reels-factory/songs/${song.id}/mv") {
            header("Authorization", "Bearer $token")
        }.andExpect {
            status { isBadRequest() }
        }
        // 미디어 토큰으로는 일반 어드민 API 를 못 쓴다
        mockMvc.get("/admin/api/reels-factory/songs/${song.id}") {
            header("Authorization", "Bearer $mediaToken")
        }.andExpect {
            status { isForbidden() }
        }

        // 캐시에서 밀려나면 404
        Files.deleteIfExists(requireNotNull(sourceCache.cached(song.id!!)))
        mockMvc.get("/admin/api/reels-factory/songs/${song.id}/mv") {
            param("token", mediaToken)
        }.andExpect {
            status { isNotFound() }
        }
    }

    private fun uploadSource(token: String, songId: Long): String {
        val body = mockMvc.multipart("/admin/api/reels-factory/songs/$songId/source") {
            header("Authorization", "Bearer $token")
            file(MockMultipartFile("file", "mv.mp4", "video/mp4", FAKE_MP4))
        }.andExpect {
            status { isOk() }
        }.andReturn().response.contentAsString
        return objectMapper.readTree(body)["mvPath"].asText()
    }

    private fun renderExpectingBadRequest(token: String, songId: Long, data: AdminReelsPromoData) {
        mockMvc.post("/admin/api/reels-factory/render") {
            header("Authorization", "Bearer $token")
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(
                AdminReelsRenderRequest(songId = songId, data = data, acknowledgeSourceRightsAndPlatformRisk = true),
            )
        }.andExpect {
            status { isBadRequest() }
            jsonPath("$.error") { value("bad_request") }
        }
    }

    /** 에디터가 보내는 모양의 props. 줄 번호는 1부터 곡 순서대로다. */
    private fun promoData(
        startFrames: List<Int>,
        lyricsEndFrame: Int,
        sourceStartFrame: Int = 0,
        vocabulary: List<AdminReelsVocabularyResponse> = emptyList(),
    ): AdminReelsPromoData = AdminReelsPromoData(
        song = AdminReelsPromoSong(title = "Lemon", artist = "米津玄師", artworkAsset = "", mvAsset = ""),
        headline = "가사0",
        instagramHandle = "@kotonoha.music",
        catchphrase = "가사에서 바로 배우는 일본어",
        sourceStartFrame = sourceStartFrame,
        lyricsEndFrame = lyricsEndFrame,
        totalLineCount = 7,
        lyricLines = startFrames.mapIndexed { i, startFrame ->
            AdminReelsPromoLine(
                startFrame = startFrame,
                lineNumber = i + 1,
                originalText = "歌詞$i",
                koreanLyrics = "가사$i",
                tokens = listOf(
                    AdminReelsPromoToken(surface = "夢", baseForm = "夢", reading = "ユメ", partOfSpeech = "NOUN", charStart = 0, charEnd = 1, koreanText = "꿈", jlpt = "N5"),
                ),
                vocabulary = vocabulary,
            )
        },
        wordCount = vocabulary.size,
    )

    private fun persistLyric(
        songId: Long,
        analyzed: Boolean = false,
        lineCount: Int = 1,
        missingTimingIndex: Int? = null,
    ): LyricEntity {
        val rawContent = (0 until lineCount).map { index ->
            LyricLineData(
                index = index,
                startTimeMs = if (index == missingTimingIndex) null else index * 2_000L,
                text = if (lineCount == 1) "歌詞" else "歌詞$index",
            )
        }
        val lyric = LyricEntity(
            songId = songId,
            lyricType = LyricType.PLAIN,
            rawContent = rawContent,
            analyzedContent = if (analyzed) rawContent.map {
                AnalyzedLine(
                    index = it.index,
                    koreanLyrics = "가사${it.index}",
                    tokens = listOf(
                        Token(
                            surface = "夢",
                            baseForm = "夢",
                            reading = "ユメ",
                            baseFormReading = "ユメ",
                            partOfSpeech = PartOfSpeech.NOUN,
                            charStart = 0,
                            charEnd = 1,
                            koreanText = "꿈",
                            jlpt = "N5",
                        ),
                    ),
                )
            } else null,
        )
        entityManager.persist(lyric)
        entityManager.flush()
        entityManager.find(SongEntity::class.java, songId).activeLyricId = lyric.id
        entityManager.flush()
        return lyric
    }

    @TestConfiguration
    class ReelsFactoryTestConfig {
        @Bean
        @Primary
        fun fakeReelsRenderService(): FakeReelsRenderService = FakeReelsRenderService()

        /** 진짜 파일 캐시를 쓰되 다른 실행에서 남은 파일이 섞이지 않게 테스트 전용 디렉토리를 준다. */
        @Bean
        @Primary
        fun testReelsSourceCache(): AdminReelsSourceCache =
            FileAdminReelsSourceCache(AdminReelsSourceProperties(directory = Files.createTempDirectory("test-reels-sources-")))
    }

    companion object {
        /** ISO BMFF 시그니처(`ftyp`)만 갖춘 최소 mp4. 캐시가 mp4 인지 검사하는 데 쓴다. */
        private val FAKE_MP4: ByteArray = byteArrayOf(0, 0, 0, 16) + "ftypisom".toByteArray() + "mp4!".toByteArray()
    }

    class FakeReelsRenderService : AdminReelsRenderService {
        var lastInput: AdminReelsRenderInput? = null
        var failWith: RuntimeException? = null

        override fun render(input: AdminReelsRenderInput): Path {
            lastInput = input
            failWith?.let { exception ->
                failWith = null
                throw exception
            }
            val dir = Files.createTempDirectory("fake-reels-")
            val output = dir.resolve("reel.mp4")
            Files.write(output, "fake mp4".toByteArray())
            return output
        }
    }
}
