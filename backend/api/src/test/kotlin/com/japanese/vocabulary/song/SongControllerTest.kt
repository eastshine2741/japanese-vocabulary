package com.japanese.vocabulary.song

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.deck.entity.DeckEntity
import com.japanese.vocabulary.song.dto.AnalyzeSongRequest
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.song.dto.RecentSongItemDto
import com.japanese.vocabulary.song.dto.SongAnalysisWorkResponse
import com.japanese.vocabulary.song.dto.SongDto
import com.japanese.vocabulary.song.dto.SongStudyDto
import com.japanese.vocabulary.song.dto.songdetail.SongLyricsDto
import com.japanese.vocabulary.song.dto.songdetail.WordsInSongDto
import com.japanese.vocabulary.songsearch.dto.SongSearchItemDto
import com.japanese.vocabulary.songsearch.dto.SongSearchResponse
import com.japanese.vocabulary.song.model.Token
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.candidate.LyricWordCandidates
import com.japanese.vocabulary.song.candidate.WordCandidate
import com.japanese.vocabulary.song.candidate.WordScoreComponents
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.songanalysis.repository.SongAnalysisWorkRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
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
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.util.Collections
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

@AutoConfigureMockMvc
class SongControllerTest : ApiBaseIntegrationTest() {

    @Autowired private lateinit var mockMvc: MockMvc
    @Autowired private lateinit var objectMapper: ObjectMapper
    @Autowired private lateinit var jwtUtil: JwtUtil
    @Autowired private lateinit var songRepository: SongRepository
    @Autowired private lateinit var lyricRepository: LyricRepository
    @Autowired private lateinit var workRepository: SongAnalysisWorkRepository
    @Autowired private lateinit var workService: SongAnalysisWorkService

    private fun newUser(): UserEntity = TestUserBuilder(entityManager).build()
    private fun newSong(title: String? = null, artist: String? = null): SongEntity =
        TestSongBuilder(entityManager)
            .let { if (title != null) it.withTitle(title) else it }
            .let { if (artist != null) it.withArtist(artist) else it }
            .build()

    private fun newLyric(
        song: SongEntity,
        raw: List<LyricLineData>,
        analyzed: List<AnalyzedLine>? = null,
        wordCandidates: LyricWordCandidates? = null,
    ): LyricEntity {
        val entity = LyricEntity(
            songId = song.id!!,
            lyricType = LyricType.PLAIN,
            rawContent = raw,
            analyzedContent = analyzed,
            wordCandidates = wordCandidates,
        )
        entityManager.persist(entity)
        entityManager.flush()
        return entity
    }

    private fun bearer(user: UserEntity): String = "Bearer ${jwtUtil.generateToken(user.id!!, user.username)}"
    private inline fun <reified T> readBody(json: String): T = objectMapper.readValue(json)

    private fun recentKey(userId: Long) = "user:$userId:recent_songs"

    @Autowired private lateinit var redis: StringRedisTemplate

    // Mark a song as recently listened (mirrors RecentSongService's ZSet, score-by-id keeps it unique).
    private fun listen(user: UserEntity, song: SongEntity) {
        redis.opsForZSet().add(recentKey(user.id!!), song.id!!.toString(), song.id!!.toDouble())
    }

    // Mark a song as "learned" by giving it a deck — getSpotlight excludes these.
    private fun learn(user: UserEntity, song: SongEntity) {
        entityManager.persist(
            DeckEntity(userId = user.id!!, songId = song.id!!, title = song.title, description = song.artist),
        )
        entityManager.flush()
    }

    @Nested
    inner class Analyze {

        @Test
        fun `existing song with lyric still creates pending work when analyze is called directly`() {
            val me = newUser()
            newSong(title = "既存曲", artist = "歌手").also { existing ->
                newLyric(
                    existing,
                    raw = listOf(LyricLineData(index = 0, startTimeMs = 0, text = "既存")),
                )
            }

            val body = mockMvc.post("/api/songs/analyze") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(
                    AnalyzeSongRequest(title = "既存曲", artist = "歌手", durationSeconds = 200),
                )
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            val dto = readBody<SongAnalysisWorkResponse>(body)
            assertThat(dto.status).isEqualTo("PENDING")
            assertThat(dto.songId).isNull()
            assertThat(dto.canOpenPlayer).isFalse
        }

        @Test
        fun `new song creates pending work without calling providers in request thread`() {
            val me = newUser()

            val body = mockMvc.post("/api/songs/analyze") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(
                    AnalyzeSongRequest(title = "新曲", artist = "新歌手", durationSeconds = 180),
                )
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            val dto = readBody<SongAnalysisWorkResponse>(body)
            assertThat(dto.status).isEqualTo("PENDING")
            assertThat(dto.songId).isNull()
            assertThat(dto.canOpenPlayer).isFalse
            assertThat(dto.isAnalysisComplete).isFalse

            entityManager.flush(); entityManager.clear()
            assertThat(songRepository.findByArtistAndTitle("新歌手", "新曲")).isNull()
            val work = workRepository.findById(dto.workId).orElseThrow()
            assertThat(work.rawTitle).isEqualTo("新曲")
            assertThat(work.rawArtist).isEqualTo("新歌手")
            assertThat(work.durationSeconds).isEqualTo(180)
        }

        @Test
        fun `provider failures are not surfaced from analyze request thread`() {
            val me = newUser()

            val body = mockMvc.post("/api/songs/analyze") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(
                    AnalyzeSongRequest(title = "なし", artist = "なし歌手"),
                )
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            assertThat(readBody<SongAnalysisWorkResponse>(body).status).isEqualTo("PENDING")

            entityManager.flush(); entityManager.clear()
            assertThat(songRepository.findByArtistAndTitle("なし歌手", "なし")).isNull()
        }

        @Test
        fun `youtube is not called from analyze request thread`() {
            val me = newUser()

            val body = mockMvc.post("/api/songs/analyze") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(
                    AnalyzeSongRequest(title = "YT失敗", artist = "歌手"),
                )
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            val dto = readBody<SongAnalysisWorkResponse>(body)
            assertThat(dto.status).isEqualTo("PENDING")
            assertThat(dto.songId).isNull()

            entityManager.flush(); entityManager.clear()
            assertThat(songRepository.findByArtistAndTitle("歌手", "YT失敗")).isNull()
        }

        @Test
        @Transactional(propagation = Propagation.NOT_SUPPORTED)
        fun `concurrent analyze requests create only one active work for same title and artist`() {
            val title = "同時作成"
            val artist = "同時歌手"
            val activeDedupKey = SongAnalysisWorkService.buildActiveDedupKey(title, artist)
            workRepository.findByActiveDedupKey(activeDedupKey)?.let { workRepository.delete(it) }

            val threadCount = 8
            val ready = CountDownLatch(threadCount)
            val start = CountDownLatch(1)
            val done = CountDownLatch(threadCount)
            val executor = Executors.newFixedThreadPool(threadCount)
            val successfulWorkIds = Collections.synchronizedList(mutableListOf<Long>())
            val conflictCount = java.util.concurrent.atomic.AtomicInteger(0)
            val unexpectedFailures = Collections.synchronizedList(mutableListOf<Throwable>())

            try {
                repeat(threadCount) {
                    executor.execute {
                        ready.countDown()
                        start.await(5, TimeUnit.SECONDS)
                        try {
                            val work = workService.createOrReuse(title = title, artist = artist)
                            successfulWorkIds.add(work.workId)
                        } catch (e: BusinessException) {
                            if (e.errorCode.name == "SONG_ANALYSIS_WORK_ALREADY_EXISTS") {
                                conflictCount.incrementAndGet()
                            } else {
                                unexpectedFailures.add(e)
                            }
                        } catch (t: Throwable) {
                            unexpectedFailures.add(t)
                        } finally {
                            done.countDown()
                        }
                    }
                }

                assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue
                start.countDown()
                assertThat(done.await(10, TimeUnit.SECONDS)).isTrue

                assertThat(unexpectedFailures).isEmpty()
                assertThat(successfulWorkIds.size + conflictCount.get()).isEqualTo(threadCount)
                assertThat(successfulWorkIds).isNotEmpty

                val activeWork = workRepository.findByActiveDedupKey(activeDedupKey)
                assertThat(activeWork).isNotNull
                assertThat(successfulWorkIds.toSet()).containsExactly(activeWork!!.id)
                assertThat(workRepository.findAll().filter { it.activeDedupKey == activeDedupKey }).hasSize(1)
            } finally {
                executor.shutdownNow()
                workRepository.findByActiveDedupKey(activeDedupKey)?.let { workRepository.delete(it) }
            }
        }
    }

    @Nested
    inner class GetAnalysisWork {

        @Test
        fun `existing work returns 200 with current state`() {
            val me = newUser()
            val created = mockMvc.post("/api/songs/analyze") {
                header("Authorization", bearer(me))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(
                    AnalyzeSongRequest(title = "조회곡", artist = "조회가수", durationSeconds = 210),
                )
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString
            val createdDto = readBody<SongAnalysisWorkResponse>(created)

            val body = mockMvc.get("/api/songs/analysis-work/${createdDto.workId}") {
                header("Authorization", bearer(me))
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            val dto = readBody<SongAnalysisWorkResponse>(body)
            assertThat(dto.workId).isEqualTo(createdDto.workId)
            assertThat(dto.status).isEqualTo("PENDING")
            assertThat(dto.songId).isNull()
            assertThat(dto.canOpenPlayer).isFalse
            assertThat(dto.isAnalysisComplete).isFalse
        }

        @Test
        fun `missing work returns 404`() {
            val me = newUser()

            mockMvc.get("/api/songs/analysis-work/999999999") {
                header("Authorization", bearer(me))
            }.andExpect {
                status { isNotFound() }
                jsonPath("$.error") { value("SONG_ANALYSIS_WORK_NOT_FOUND") }
            }
        }
    }

    @Nested
    inner class GetByTitleAndArtist {

        @Test
        fun `existing song with lyric returns player data by exact title and artist`() {
            val me = newUser()
            val song = newSong(title = "既存曲", artist = "歌手")
            newLyric(
                song,
                raw = listOf(LyricLineData(index = 0, startTimeMs = 0, text = "既存")),
            )

            val body = mockMvc.get("/api/songs") {
                header("Authorization", bearer(me))
                param("title", "既存曲")
                param("artistName", "歌手")
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            val dto = readBody<SongStudyDto>(body)
            assertThat(dto.song.id).isEqualTo(song.id)
            assertThat(dto.studyUnits.map { it.originalText }).containsExactly("既存")
            assertThat(redis.opsForZSet().reverseRange(recentKey(me.id!!), 0, -1))
                .contains(song.id.toString())
        }

        @Test
        fun `missing song returns 204 by title and artist`() {
            val me = newUser()

            mockMvc.get("/api/songs") {
                header("Authorization", bearer(me))
                param("title", "없는곡")
                param("artistName", "없는가수")
            }.andExpect { status { isNoContent() } }
        }

        @Test
        fun `existing song without lyric returns 204 so analysis work can create lyric`() {
            val me = newUser()
            newSong(title = "가사없음", artist = "가수")

            mockMvc.get("/api/songs") {
                header("Authorization", bearer(me))
                param("title", "가사없음")
                param("artistName", "가수")
            }.andExpect { status { isNoContent() } }
        }
    }

    @Nested
    inner class GetById {

        @Test
        fun `GET song by id returns metadata only and records recent`() {
            val me = newUser()
            val song = TestSongBuilder(entityManager)
                .withDuration(240)
                .withYoutubeUrl("https://youtube.example/mv")
                .withArtworkUrl("https://art.example/cover.jpg")
                .build()
            newLyric(
                song,
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
            assertThat(dto.id).isEqualTo(song.id)
            assertThat(dto.title).isEqualTo(song.title)
            assertThat(dto.youtubeUrl).isEqualTo(song.youtubeUrl)
            assertThat(body).doesNotContain("studyUnits")
            assertThat(body).doesNotContain("tokens")
            assertThat(redis.opsForZSet().reverseRange(recentKey(me.id!!), 0, -1))
                .contains(song.id.toString())
        }

        @Test
        fun `lyrics endpoint returns display lines without recording recent`() {
            val me = newUser()
            val song = newSong()
            newLyric(
                song,
                raw = listOf(LyricLineData(index = 0, startTimeMs = 0, text = "待機中")),
            )

            val body = mockMvc.get("/api/songs/${song.id}/lyrics") {
                header("Authorization", bearer(me))
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            assertThat(body).contains("\"originalText\":\"待機中\"")
            assertThat(body).doesNotContain("tokens")
            assertThat(redis.opsForZSet().size(recentKey(me.id!!)) ?: 0).isZero
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
    inner class SongDetailLyrics {

        @Test
        fun `lyrics endpoint returns display lines without tokens and does not record recent listen`() {
            val me = newUser()
            val song = newSong()
            val lyric = newLyric(
                song,
                raw = listOf(LyricLineData(index = 2, startTimeMs = 1234, text = "夜を越える")),
                analyzed = listOf(
                    AnalyzedLine(
                        index = 2,
                        koreanLyrics = "밤을 넘다",
                        koreanPronounciation = "요루오 코에루",
                        tokens = listOf(
                            Token("夜", "夜", "よる", "よる", PartOfSpeech.NOUN, 0, 1),
                        ),
                    ),
                ),
            )

            val body = mockMvc.get("/api/songs/${song.id}/lyrics") {
                header("Authorization", bearer(me))
            }.andExpect {
                status { isOk() }
                header { string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")) }
                jsonPath("$.lyricId") { value(lyric.id!!.toInt()) }
                jsonPath("$.lines[0].index") { value(2) }
                jsonPath("$.lines[0].originalText") { value("夜を越える") }
                jsonPath("$.lines[0].koreanLyrics") { value("밤을 넘다") }
                jsonPath("$.lines[0].tokens") { doesNotExist() }
                jsonPath("$.words") { doesNotExist() }
            }.andReturn().response.contentAsString

            assertThat(readBody<SongLyricsDto>(body).lyricId).isEqualTo(lyric.id)
            assertThat(redis.opsForZSet().size(recentKey(me.id!!)) ?: 0).isZero
        }
    }

    @Nested
    inner class SongDetailWords {

        @Test
        fun `missing word candidates returns empty words and does not record recent listen`() {
            val me = newUser()
            val song = newSong()
            newLyric(song, raw = listOf(LyricLineData(index = 0, startTimeMs = null, text = "待機中")))

            val dto = readBody<WordsInSongDto>(mockMvc.get("/api/songs/${song.id}/words") {
                header("Authorization", bearer(me))
            }.andExpect {
                status { isOk() }
                header { string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")) }
                jsonPath("$.words") { isEmpty() }
                jsonPath("$.lineWordIndexes") { isEmpty() }
            }.andReturn().response.contentAsString)

            assertThat(dto.lyricId).isNotNull
            assertThat(redis.opsForZSet().size(recentKey(me.id!!)) ?: 0).isZero
        }

        @Test
        fun `ready words response remaps line indexes and exposes saved state plus add request`() {
            val me = newUser()
            val song = newSong()
            val wordCandidates = LyricWordCandidates(
                candidates = listOf(
                    candidate("低", 10.0, 1, listOf(0), "N5", "NOUN"),
                    candidate("高", 99.0, 0, listOf(0, 1), "N3", "VERB", baseFormReading = "たかい"),
                ),
                lineCandidates = mapOf("0" to listOf(0, 1), "1" to listOf(1)),
            )
            val lyric = newLyric(
                song,
                raw = listOf(
                    LyricLineData(index = 0, startTimeMs = null, text = "高く低く"),
                    LyricLineData(index = 1, startTimeMs = null, text = "高く"),
                ),
                analyzed = listOf(AnalyzedLine(index = 0, koreanLyrics = "높고 낮게", koreanPronounciation = null, tokens = emptyList())),
                wordCandidates = wordCandidates,
            )
            val savedWord = com.japanese.vocabulary.test.fixtures.TestWordBuilder(entityManager)
                .forUser(me)
                .withJapaneseText("高")
                .build()
            entityManager.persist(com.japanese.vocabulary.word.entity.SongWordEntity(wordId = savedWord.id!!, songId = song.id!!, lyricLine = "高く低く"))
            entityManager.flush()

            val dto = readBody<WordsInSongDto>(mockMvc.get("/api/songs/${song.id}/words") {
                header("Authorization", bearer(me))
            }.andExpect {
                status { isOk() }
                jsonPath("$.words[0].japanese") { value("高") }
                jsonPath("$.words[0].isSavedGlobally") { value(true) }
                jsonPath("$.words[0].isSavedForSong") { value(true) }
                jsonPath("$.words[0].savedWordId") { value(savedWord.id!!.toInt()) }
                jsonPath("$.words[0].addRequest.japanese") { value("高") }
                jsonPath("$.words[0].addRequest.reading") { value("たかい") }
                jsonPath("$.words[0].addRequest.lyricLine") { value("高く低く") }
                jsonPath("$.words[0].addRequest.koreanLyricLine") { value("높고 낮게") }
            }.andReturn().response.contentAsString)

            assertThat(dto.lyricId).isEqualTo(lyric.id)
            assertThat(dto.wordSummary.topWords).hasSize(2)
            assertThat(dto.wordSummary.jlptDistribution["N3"]).isEqualTo(1)
            assertThat(dto.lineWordIndexes[0]).containsExactly(1, 0)
            assertThat(dto.lineWordIndexes[1]).containsExactly(0)
            assertThat(dto.wordSummary.defaultBulkAddCount).isEqualTo(1)
        }

        private fun candidate(
            japanese: String,
            score: Double,
            order: Int,
            lineIndexes: List<Int>,
            jlpt: String,
            pos: String,
            baseFormReading: String? = null,
        ) = WordCandidate(
            japanese = japanese,
            surface = japanese,
            baseForm = japanese,
            reading = null,
            baseFormReading = baseFormReading,
            koreanText = "$japanese-ko",
            partOfSpeech = pos,
            partOfSpeechLabel = pos,
            jlpt = jlpt,
            importanceScore = score,
            appearanceOrder = order,
            frequency = lineIndexes.size,
            lineIndexes = lineIndexes,
            scoreComponents = WordScoreComponents(0.0, 0.0, 0.0, 0.0, 1.0),
        )
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
    inner class Spotlight {

        @Test
        fun `204 when user has no recent songs`() {
            val me = newUser()

            mockMvc.get("/api/songs/spotlight") {
                header("Authorization", bearer(me))
            }.andExpect { status { isNoContent() } }
        }

        @Test
        fun `204 when every recent song is already learned`() {
            val me = newUser()
            val s1 = newSong(); val s2 = newSong()
            listen(me, s1); listen(me, s2)
            learn(me, s1); learn(me, s2)

            mockMvc.get("/api/songs/spotlight") {
                header("Authorization", bearer(me))
            }.andExpect { status { isNoContent() } }
        }

        @Test
        fun `returns a recent song the user has not learned`() {
            val me = newUser()
            val learned = newSong(); val fresh = newSong()
            listen(me, learned); listen(me, fresh)
            learn(me, learned)

            val body = mockMvc.get("/api/songs/spotlight") {
                header("Authorization", bearer(me))
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            assertThat(readBody<SongStudyDto>(body).song.id).isEqualTo(fresh.id)
        }

        @Test
        fun `decks of other users do not exclude a song`() {
            val me = newUser()
            val other = newUser()
            val song = newSong()
            listen(me, song)
            learn(other, song) // someone else learned it — must not affect me

            val body = mockMvc.get("/api/songs/spotlight") {
                header("Authorization", bearer(me))
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString

            assertThat(readBody<SongStudyDto>(body).song.id).isEqualTo(song.id)
        }

        @Test
        fun `picks randomly among unlearned songs and never surfaces a learned one`() {
            val me = newUser()
            val learned = newSong()
            listen(me, learned); learn(me, learned)
            val fresh = (1..4).map { newSong() }
            fresh.forEach { listen(me, it) }
            val freshIds = fresh.mapNotNull { it.id }.toSet()

            val seen = mutableSetOf<Long?>()
            repeat(40) {
                val body = mockMvc.get("/api/songs/spotlight") {
                    header("Authorization", bearer(me))
                }.andExpect { status { isOk() } }.andReturn().response.contentAsString
                seen.add(readBody<SongStudyDto>(body).song.id)
            }

            // Only unlearned songs are ever surfaced; the learned one never appears.
            assertThat(seen).isSubsetOf(freshIds)
            assertThat(seen).doesNotContain(learned.id)
            // With 4 candidates over 40 draws, always returning a single fixed song is
            // effectively impossible (~4·(1/4)^40), so this proves the pick is randomized.
            assertThat(seen.size).isGreaterThan(1)
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
