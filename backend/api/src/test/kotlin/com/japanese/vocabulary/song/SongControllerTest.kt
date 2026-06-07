package com.japanese.vocabulary.song

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.song.client.LyricsResult
import com.japanese.vocabulary.song.dto.AnalyzeSongRequest
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.song.dto.RecentSongItemDto
import com.japanese.vocabulary.song.dto.SongDto
import com.japanese.vocabulary.song.dto.SongSearchItemDto
import com.japanese.vocabulary.song.dto.SongSearchResponse
import com.japanese.vocabulary.song.model.Token
import com.japanese.vocabulary.song.entity.KoreanLyricStatus
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.test.ApiBaseIntegrationTest
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.user.entity.UserEntity
import io.mockk.every
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post

@AutoConfigureMockMvc
class SongControllerTest : ApiBaseIntegrationTest() {

    @Autowired private lateinit var mockMvc: MockMvc
    @Autowired private lateinit var objectMapper: ObjectMapper
    @Autowired private lateinit var jwtUtil: JwtUtil
    @Autowired private lateinit var songRepository: SongRepository
    @Autowired private lateinit var lyricRepository: LyricRepository

    private fun newUser(): UserEntity = TestUserBuilder(entityManager).build()
    private fun newSong(title: String? = null, artist: String? = null): SongEntity =
        TestSongBuilder(entityManager)
            .let { if (title != null) it.withTitle(title) else it }
            .let { if (artist != null) it.withArtist(artist) else it }
            .build()

    private fun newLyric(
        song: SongEntity,
        status: KoreanLyricStatus,
        raw: List<LyricLineData>,
        analyzed: List<AnalyzedLine>? = null,
    ): LyricEntity {
        val entity = LyricEntity(
            songId = song.id!!,
            lyricType = LyricType.PLAIN,
            rawContent = raw,
            analyzedContent = analyzed,
            status = status,
        )
        entityManager.persist(entity)
        entityManager.flush()
        return entity
    }

    private fun bearer(user: UserEntity): String = "Bearer ${jwtUtil.generateToken(user.id!!, user.username)}"
    private inline fun <reified T> readBody(json: String): T = objectMapper.readValue(json)

    private fun recentKey(userId: Long) = "user:$userId:recent_songs"

    @Autowired private lateinit var redis: StringRedisTemplate

    @Nested
    inner class Analyze {

        @Test
        fun `existing song hits DB and skips external providers`() {
            val me = newUser()
            val existing = newSong(title = "既存曲", artist = "歌手")

            val body = mockMvc.post("/api/songs/analyze") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(
                    AnalyzeSongRequest(title = "既存曲", artist = "歌手", durationSeconds = 200),
                )
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            assertThat(readBody<SongDto>(body).song.id).isEqualTo(existing.id)
            // recent recorded for this user
            val recents = redis.opsForZSet().reverseRange(recentKey(me.id!!), 0, -1)
            assertThat(recents).contains(existing.id.toString())
            // no LyricEntity created since song already existed without one
            assertThat(lyricRepository.findBySongId(existing.id!!)).isNull()
        }

        @Test
        fun `new song from LRClib persists Song and Lyric(PENDING) and pulls youtube url`() {
            val me = newUser()
            every { lrclibClient.providerName } returns "LRCLIB"
            every { lrclibClient.search(any()) } returns LyricsResult(
                lrclibId = 42,
                lyrics = "ライン1\nライン2",
                isSynced = false,
            )
            every { vocadbClient.providerName } returns "VocaDB"
            every { vocadbClient.search(any()) } returns null
            every { youtubeClient.searchMvUrl(any(), any()) } returns "https://youtu.be/abc"

            val body = mockMvc.post("/api/songs/analyze") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(
                    AnalyzeSongRequest(title = "新曲", artist = "新歌手", durationSeconds = 180),
                )
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            val dto = readBody<SongDto>(body)
            assertThat(dto.youtubeUrl).isEqualTo("https://youtu.be/abc")
            assertThat(dto.lyricsSourceName).isEqualTo("LRCLIB")
            assertThat(dto.studyUnits.map { it.originalText }).containsExactly("ライン1", "ライン2")

            entityManager.flush(); entityManager.clear()
            val savedSong = songRepository.findByArtistAndTitle("新歌手", "新曲")!!
            val savedLyric = lyricRepository.findBySongId(savedSong.id!!)!!
            assertThat(savedLyric.status).isEqualTo(KoreanLyricStatus.PENDING)
            assertThat(savedLyric.analyzedContent.isNullOrEmpty()).isTrue
            assertThat(savedLyric.lrclibId).isEqualTo(42L)

            assertThat(redis.opsForZSet().reverseRange(recentKey(me.id!!), 0, -1))
                .contains(savedSong.id.toString())
        }

        @Test
        fun `all providers returning null surfaces LYRICS_NOT_FOUND`() {
            val me = newUser()
            every { lrclibClient.providerName } returns "LRCLIB"
            every { lrclibClient.search(any()) } returns null
            every { vocadbClient.providerName } returns "VocaDB"
            every { vocadbClient.search(any()) } returns null

            mockMvc.post("/api/songs/analyze") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(
                    AnalyzeSongRequest(title = "なし", artist = "なし歌手"),
                )
            }.andExpect { status { isNotFound() } }

            entityManager.flush(); entityManager.clear()
            assertThat(songRepository.findByArtistAndTitle("なし歌手", "なし")).isNull()
        }

        @Test
        fun `youtube failure is swallowed and youtubeUrl stays null`() {
            val me = newUser()
            every { lrclibClient.providerName } returns "LRCLIB"
            every { lrclibClient.search(any()) } returns LyricsResult(lyrics = "テスト", isSynced = false)
            every { vocadbClient.providerName } returns "VocaDB"
            every { vocadbClient.search(any()) } returns null
            every { youtubeClient.searchMvUrl(any(), any()) } throws RuntimeException("network down")

            val body = mockMvc.post("/api/songs/analyze") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(
                    AnalyzeSongRequest(title = "YT失敗", artist = "歌手"),
                )
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            val dto = readBody<SongDto>(body)
            assertThat(dto.youtubeUrl).isNull()

            entityManager.flush(); entityManager.clear()
            val savedSong = songRepository.findByArtistAndTitle("歌手", "YT失敗")!!
            assertThat(savedSong.youtubeUrl).isNull()
        }
    }

    @Nested
    inner class GetById {

        @Test
        fun `COMPLETED lyric returns studyUnits with tokens`() {
            val me = newUser()
            val song = newSong()
            newLyric(
                song,
                status = KoreanLyricStatus.COMPLETED,
                raw = listOf(LyricLineData(index = 0, startTimeMs = 0, text = "夜")),
                analyzed = listOf(
                    AnalyzedLine(
                        index = 0,
                        koreanLyrics = "밤",
                        koreanPronounciation = "요루",
                        tokens = listOf(
                            Token(
                                surface = "夜",
                                baseForm = "夜",
                                reading = "よる",
                                baseFormReading = "よる",
                                partOfSpeech = PartOfSpeech.NOUN,
                                charStart = 0,
                                charEnd = 1,
                            ),
                        ),
                    ),
                ),
            )

            val body = mockMvc.get("/api/songs/${song.id}") {
                header("Authorization", bearer(me))
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            val dto = readBody<SongDto>(body)
            assertThat(dto.studyUnits).hasSize(1)
            assertThat(dto.studyUnits.single().koreanLyrics).isEqualTo("밤")
            assertThat(dto.studyUnits.single().tokens).hasSize(1)

            assertThat(redis.opsForZSet().reverseRange(recentKey(me.id!!), 0, -1))
                .contains(song.id.toString())
        }

        @Test
        fun `PENDING lyric returns raw studyUnits without tokens`() {
            val me = newUser()
            val song = newSong()
            newLyric(
                song,
                status = KoreanLyricStatus.PENDING,
                raw = listOf(LyricLineData(index = 0, startTimeMs = 0, text = "待機中")),
            )

            val body = mockMvc.get("/api/songs/${song.id}") {
                header("Authorization", bearer(me))
            }.andReturn().response.contentAsString

            val dto = readBody<SongDto>(body)
            assertThat(dto.studyUnits.single().originalText).isEqualTo("待機中")
            assertThat(dto.studyUnits.single().tokens).isEmpty()
            assertThat(dto.studyUnits.single().koreanLyrics).isNull()
        }

        @Test
        fun `unknown song id returns 404 and does not record recent`() {
            val me = newUser()

            mockMvc.get("/api/songs/999999") {
                header("Authorization", bearer(me))
            }.andExpect { status { isNotFound() } }

            assertThat(redis.opsForZSet().size(recentKey(me.id!!)) ?: 0).isZero
        }
    }

    @Nested
    inner class Recent {

        @Test
        fun `empty when nothing recorded`() {
            val me = newUser()

            val body = mockMvc.get("/api/songs/recent") {
                header("Authorization", bearer(me))
            }.andReturn().response.contentAsString

            assertThat(readBody<List<RecentSongItemDto>>(body)).isEmpty()
        }

        @Test
        fun `returns recently-listened songs in reverse-chronological order, isolated per user`() {
            val me = newUser()
            val other = newUser()
            val s1 = newSong(title = "A", artist = "A歌手")
            val s2 = newSong(title = "B", artist = "B歌手")
            val s3 = newSong(title = "C", artist = "C歌手")

            // Hit recordListen via getSongById to keep wiring realistic.
            mockMvc.get("/api/songs/${s1.id}") { header("Authorization", bearer(me)) }
            mockMvc.get("/api/songs/${s2.id}") { header("Authorization", bearer(me)) }
            mockMvc.get("/api/songs/${s3.id}") { header("Authorization", bearer(me)) }
            // Other user listens only to s1 — must not leak.
            mockMvc.get("/api/songs/${s1.id}") { header("Authorization", bearer(other)) }

            val myBody = mockMvc.get("/api/songs/recent") {
                header("Authorization", bearer(me))
            }.andReturn().response.contentAsString
            val ids = readBody<List<RecentSongItemDto>>(myBody).map { it.id }
            assertThat(ids).containsExactly(s3.id, s2.id, s1.id)

            val otherBody = mockMvc.get("/api/songs/recent") {
                header("Authorization", bearer(other))
            }.andReturn().response.contentAsString
            assertThat(readBody<List<RecentSongItemDto>>(otherBody).map { it.id })
                .containsExactly(s1.id)
        }
    }

    @Nested
    inner class Search {

        @Test
        fun `blank query returns empty without calling iTunes`() {
            val me = newUser()

            val body = mockMvc.get("/api/songs/search") {
                header("Authorization", bearer(me))
                param("q", "   ")
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            assertThat(readBody<SongSearchResponse>(body).items).isEmpty()
            io.mockk.verify(exactly = 0) { itunesClient.search(any()) }
        }

        @Test
        fun `same query within TTL is served from Redis cache`() {
            val me = newUser()
            every { itunesClient.search("query") } returns SongSearchResponse(
                items = listOf(
                    SongSearchItemDto(id = "1", title = "曲", thumbnail = "thumb", artistName = "歌手", durationSeconds = 200),
                ),
            )

            val firstBody = mockMvc.get("/api/songs/search") {
                header("Authorization", bearer(me))
                param("q", "query")
            }.andReturn().response.contentAsString
            val first = readBody<SongSearchResponse>(firstBody)

            val secondBody = mockMvc.get("/api/songs/search") {
                header("Authorization", bearer(me))
                param("q", "query")
            }.andReturn().response.contentAsString
            val second = readBody<SongSearchResponse>(secondBody)

            assertThat(first).isEqualTo(second)
            io.mockk.verify(exactly = 1) { itunesClient.search("query") }
        }

        @Test
        fun `cache key normalization treats whitespace and case as equivalent`() {
            val me = newUser()
            every { itunesClient.search(any()) } returns SongSearchResponse(items = emptyList())

            mockMvc.get("/api/songs/search") {
                header("Authorization", bearer(me))
                param("q", "MySong")
            }
            mockMvc.get("/api/songs/search") {
                header("Authorization", bearer(me))
                param("q", "  mysong  ")
            }

            io.mockk.verify(exactly = 1) { itunesClient.search(any()) }
        }
    }
}
