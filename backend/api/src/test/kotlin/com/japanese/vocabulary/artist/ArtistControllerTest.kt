package com.japanese.vocabulary.artist

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.japanese.vocabulary.artist.dto.ArtistDetailDto
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.deck.entity.DeckEntity
import com.japanese.vocabulary.song.dto.SongDto
import com.japanese.vocabulary.song.entity.ArtistEntity
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.model.LyricWordCandidates
import com.japanese.vocabulary.song.model.WordCandidate
import com.japanese.vocabulary.song.model.WordScoreComponents
import com.japanese.vocabulary.songsearch.dto.SongSearchItemDto
import com.japanese.vocabulary.test.ApiBaseIntegrationTest
import com.japanese.vocabulary.test.fixtures.TestFlashcardBuilder
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.test.fixtures.TestWordBuilder
import com.japanese.vocabulary.user.entity.UserEntity
import io.mockk.every
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get

@AutoConfigureMockMvc
class ArtistControllerTest : ApiBaseIntegrationTest() {

    @Autowired private lateinit var mockMvc: MockMvc
    @Autowired private lateinit var objectMapper: ObjectMapper
    @Autowired private lateinit var jwtUtil: JwtUtil

    @Test
    fun `studying songs are my song decks of the artist, by coverage, and popular songs leave them out`() {
        val me = newUser()
        val artist = newArtist()
        val known = newSong("分かる曲", artist, word = "胸")
        val unknown = newSong("分からない曲", artist, word = "雨")
        newSong("学んでない曲", artist, word = "空")
        val otherArtistSong = newSong("別の歌手", newArtist(), word = "胸")
        listOf(unknown, known, otherArtistSong).forEach { newDeck(me, it) }
        val word = TestWordBuilder(entityManager).forUser(me).withJapaneseText("胸").build()
        TestFlashcardBuilder(entityManager, clock).forUser(me).ofWord(word)
            .withState(1).withStability(7.0).lastReviewedAt(clock.instant()).dueAt(clock.instant().plusSeconds(86_400 * 30)).build()
        entityManager.flush()
        every { appleMusicClient.topSongs(artist.appleMusicId) } returns listOf(
            catalogSong("分かる曲"),
            catalogSong("学んでない曲"),
            catalogSong("まだ無い曲"),
        )

        val dto = detail(me, artist.id!!)

        assertThat(dto.name).isEqualTo("テスト歌手")
        assertThat(dto.artworkUrl).isEqualTo("https://img/artist.jpg")
        assertThat(dto.appleMusicUrl).isEqualTo("https://music/artist")
        assertThat(dto.studyingSongs.map { it.title }).containsExactly("分かる曲", "分からない曲")
        assertThat(dto.studyingSongs.map { it.knownLines to it.totalLines }).containsExactly(1 to 1, 0 to 1)
        assertThat(dto.popularSongs.map { it.title }).containsExactly("学んでない曲", "まだ無い曲")
    }

    @Test
    fun `popular songs are cached so the catalog is asked once`() {
        val me = newUser()
        val artist = newArtist()
        every { appleMusicClient.topSongs(artist.appleMusicId) } returns listOf(catalogSong("人気曲"))

        detail(me, artist.id!!)
        val second = detail(me, artist.id!!)

        assertThat(second.popularSongs.map { it.title }).containsExactly("人気曲")
        verify(exactly = 1) { appleMusicClient.topSongs(artist.appleMusicId) }
    }

    @Test
    fun `a catalog failure still opens the screen without popular songs`() {
        val me = newUser()
        val artist = newArtist()
        every { appleMusicClient.topSongs(any()) } throws IllegalStateException("down")

        assertThat(detail(me, artist.id!!).popularSongs).isEmpty()
    }

    @Test
    fun `unknown artist is 404`() {
        mockMvc.get("/api/artists/999999") {
            header("Authorization", bearer(newUser()))
        }.andExpect { status { isNotFound() } }
    }

    @Test
    fun `song metadata links to its artist`() {
        val artist = newArtist()
        val song = newSong("リンク曲", artist, word = "胸")

        val dto = objectMapper.readValue<SongDto>(mockMvc.get("/api/songs/${song.id}") {
            header("Authorization", bearer(newUser()))
        }.andExpect { status { isOk() } }.andReturn().response.contentAsString)

        assertThat(dto.artistId).isEqualTo(artist.id)
    }

    private fun detail(user: UserEntity, artistId: Long): ArtistDetailDto =
        objectMapper.readValue(mockMvc.get("/api/artists/$artistId") {
            header("Authorization", bearer(user))
        }.andExpect { status { isOk() } }.andReturn().response.contentAsString)

    private fun newUser(): UserEntity = TestUserBuilder(entityManager).build()

    private fun bearer(user: UserEntity) = "Bearer ${jwtUtil.generateToken(user.id!!, user.username)}"

    private var nextAppleMusicId = 900_000

    private fun newArtist(): ArtistEntity =
        ArtistEntity(
            appleMusicId = (nextAppleMusicId++).toString(),
            name = "テスト歌手",
            artworkUrl = "https://img/artist.jpg",
            appleMusicUrl = "https://music/artist",
        ).also { entityManager.persist(it) }

    /** 가사 한 줄에 단어 하나. 그 단어가 장기기억이면 이해도 1/1, 아니면 0/1. */
    private fun newSong(title: String, artist: ArtistEntity, word: String): SongEntity {
        val song = SongEntity(title = title, artist = artist.name, artistId = artist.id).also { entityManager.persist(it) }
        val lyric = LyricEntity(
            songId = song.id!!,
            lyricType = LyricType.PLAIN,
            rawContent = listOf(LyricLineData(index = 0, startTimeMs = null, text = word)),
            wordCandidates = LyricWordCandidates(
                candidates = listOf(
                    WordCandidate(
                        japanese = word, surface = word, baseForm = word, reading = null, baseFormReading = null,
                        koreanText = "$word-ko", partOfSpeech = "NOUN", partOfSpeechLabel = "NOUN", jlpt = "N3",
                        importanceScore = 1.0, appearanceOrder = 0, frequency = 1, lineIndexes = listOf(0),
                        scoreComponents = WordScoreComponents(0.0, 0.0, 0.0, 0.0, 1.0),
                    ),
                ),
                lineCandidates = mapOf("0" to listOf(0)),
            ),
        ).also { entityManager.persist(it) }
        song.activeLyricId = lyric.id
        entityManager.flush()
        return song
    }

    private fun newDeck(user: UserEntity, song: SongEntity) =
        entityManager.persist(DeckEntity(userId = user.id!!, songId = song.id, title = song.title, description = ""))

    private fun catalogSong(title: String) =
        SongSearchItemDto(id = title, title = title, thumbnail = "thumb", artistName = "テスト歌手", durationSeconds = 200)
}
