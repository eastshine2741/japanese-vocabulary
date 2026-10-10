package com.japanese.vocabulary.rewardcard

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.japanese.vocabulary.auth.jwt.JwtUtil
import com.japanese.vocabulary.deck.entity.DeckEntity
import com.japanese.vocabulary.deck.entity.DeckWordEntity
import com.japanese.vocabulary.flashcard.dto.ReviewRequest
import com.japanese.vocabulary.flashcard.dto.ReviewResponse
import com.japanese.vocabulary.flashcard.entity.FlashcardEntity
import com.japanese.vocabulary.rewardcard.dto.PendingRewardCardsResponse
import com.japanese.vocabulary.rewardcard.dto.RewardCardGoalResponse
import com.japanese.vocabulary.rewardcard.dto.RewardCardRevealDto
import com.japanese.vocabulary.rewardcard.dto.RewardCardsResponse
import com.japanese.vocabulary.rewardcard.dto.SongAchievementDto
import com.japanese.vocabulary.rewardcard.model.RewardCardKind
import com.japanese.vocabulary.rewardcard.model.SongCardGrade
import com.japanese.vocabulary.rewardcard.service.RewardCardService
import com.japanese.vocabulary.song.entity.ArtistEntity
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.model.LyricWordCandidates
import com.japanese.vocabulary.song.model.WordCandidate
import com.japanese.vocabulary.song.model.WordScoreComponents
import com.japanese.vocabulary.song.dto.songdetail.SongStudyBootstrapResponse
import com.japanese.vocabulary.test.ApiBaseIntegrationTest
import com.japanese.vocabulary.test.fixtures.TestFlashcardBuilder
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.test.fixtures.TestWordBuilder
import com.japanese.vocabulary.user.entity.UserEntity
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.ResultActionsDsl
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put

@AutoConfigureMockMvc
class RewardCardControllerTest : ApiBaseIntegrationTest() {

    @Autowired private lateinit var mockMvc: MockMvc
    @Autowired private lateinit var objectMapper: ObjectMapper
    @Autowired private lateinit var jwtUtil: JwtUtil
    @Autowired private lateinit var rewardCardService: RewardCardService

    private val signature = listOf("M 10 10 Q 20 20 30 10")

    private fun newUser(): UserEntity = TestUserBuilder(entityManager).build()
    private fun bearer(user: UserEntity) = "Bearer ${jwtUtil.generateToken(user.id!!, user.username)}"
    private inline fun <reified T> readBody(json: String): T = objectMapper.readValue(json)

    private fun newArtist(): ArtistEntity =
        ArtistEntity(appleMusicId = "am-${System.nanoTime()}", name = "YOASOBI").also { entityManager.persist(it) }

    /** 胸 = 후렴 정복, 雨 = 따라 부르기, 輪郭 = 완곡. */
    private fun newSong(artist: ArtistEntity?): SongEntity {
        val song = TestSongBuilder(entityManager).build()
        song.artistId = artist?.id
        val lyric = LyricEntity(
            songId = song.id!!,
            lyricType = LyricType.PLAIN,
            rawContent = listOf(
                LyricLineData(index = 0, startTimeMs = null, text = "후렴"),
                LyricLineData(index = 1, startTimeMs = null, text = "절"),
                LyricLineData(index = 2, startTimeMs = null, text = "후렴"),
            ),
            wordCandidates = LyricWordCandidates(
                candidates = listOf(
                    candidate("胸", 0, listOf(0, 2), jlpt = "N3"),
                    candidate("雨", 1, listOf(1), jlpt = "N5"),
                    candidate("輪郭", 2, listOf(1), jlpt = null),
                ),
                lineCandidates = mapOf("0" to listOf(0), "1" to listOf(1, 2), "2" to listOf(0)),
            ),
        )
        entityManager.persist(lyric)
        song.activeLyricId = lyric.id
        entityManager.flush()
        return song
    }

    private fun candidate(japanese: String, order: Int, lineIndexes: List<Int>, jlpt: String?) = WordCandidate(
        japanese = japanese,
        surface = japanese,
        baseForm = japanese,
        reading = null,
        baseFormReading = null,
        koreanText = "$japanese-ko",
        partOfSpeech = "NOUN",
        partOfSpeechLabel = "NOUN",
        jlpt = jlpt,
        importanceScore = 50.0 - order,
        appearanceOrder = order,
        frequency = lineIndexes.size,
        lineIndexes = lineIndexes,
        scoreComponents = WordScoreComponents(0.0, 0.0, 0.0, 0.0, 1.0),
    )

    /** 곡 단어장에 담긴 새 카드. */
    private fun studyWord(user: UserEntity, song: SongEntity, japanese: String): FlashcardEntity {
        val deck = entityManager.createQuery(
            "SELECT d FROM DeckEntity d WHERE d.userId = :u AND d.songId = :s", DeckEntity::class.java,
        ).setParameter("u", user.id).setParameter("s", song.id).resultList.firstOrNull()
            ?: DeckEntity(userId = user.id!!, songId = song.id!!, title = song.title, description = song.artist)
                .also { entityManager.persist(it) }
        val word = TestWordBuilder(entityManager).forUser(user).withJapaneseText(japanese).build()
        entityManager.persist(DeckWordEntity(deckId = deck.id!!, wordId = word.id!!))
        return TestFlashcardBuilder(entityManager, clock).forUser(user).ofWord(word).dueAt(clock.instant()).build()
            .also { entityManager.flush() }
    }

    private fun review(user: UserEntity, card: FlashcardEntity): List<RewardCardRevealDto> =
        readBody<ReviewResponse>(
            mockMvc.post("/api/flashcards/${card.id}/review") {
                header("Authorization", bearer(user))
                contentType = MediaType.APPLICATION_JSON
                content = objectMapper.writeValueAsString(ReviewRequest(rating = 3))
            }.andExpect { status { isOk() } }.andReturn().response.contentAsString
        ).rewardCards

    private fun pending(user: UserEntity): List<RewardCardRevealDto> =
        readBody<PendingRewardCardsResponse>(
            mockMvc.get("/api/reward-cards/pending") { header("Authorization", bearer(user)) }
                .andExpect { status { isOk() } }.andReturn().response.contentAsString
        ).reveals

    private fun cards(user: UserEntity): RewardCardsResponse =
        readBody(
            mockMvc.get("/api/reward-cards") { header("Authorization", bearer(user)) }
                .andExpect { status { isOk() } }.andReturn().response.contentAsString
        )

    private fun postJson(user: UserEntity, path: String, body: Any): ResultActionsDsl =
        mockMvc.post(path) {
            header("Authorization", bearer(user))
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(body)
        }

    private fun reveal(kind: RewardCardKind, targetId: Long, grade: String, seenGrade: String?, seq: Int) =
        RewardCardRevealDto(kind = kind, targetId = targetId, grade = grade, seenGrade = seenGrade, acquiredSeq = seq)

    @Test
    fun `first rating in a song deck acquires the song card then the artist card`() {
        val me = newUser()
        val artist = newArtist()
        val song = newSong(artist)
        val card = studyWord(me, song, "輪郭")

        val reveals = review(me, card)

        assertThat(reveals).containsExactly(
            reveal(RewardCardKind.SONG, song.id!!, "BASIC", null, 1),
            reveal(RewardCardKind.ARTIST, artist.id!!, "BASIC", null, 1),
        )
        assertThat(pending(me)).isEqualTo(reveals)
    }

    @Test
    fun `acquisition order is per song and per artist across users`() {
        val artist = newArtist()
        val song = newSong(artist)
        val first = newUser()
        val second = newUser()

        review(first, studyWord(first, song, "輪郭"))
        val reveals = review(second, studyWord(second, song, "輪郭"))

        assertThat(reveals.map { it.acquiredSeq }).containsExactly(2, 2)
    }

    @Test
    fun `one rating acquires every song deck holding the word, songs first then artists by id`() {
        val me = newUser()
        val earlierArtist = newArtist()
        val laterArtist = newArtist()
        val first = newSong(laterArtist)
        val second = newSong(earlierArtist)
        val card = studyWord(me, first, "輪郭")
        val secondDeck = DeckEntity(userId = me.id!!, songId = second.id!!, title = second.title, description = second.artist)
            .also { entityManager.persist(it) }
        entityManager.persist(DeckWordEntity(deckId = secondDeck.id!!, wordId = card.wordId))
        entityManager.flush()

        assertThat(review(me, card)).containsExactly(
            reveal(RewardCardKind.SONG, first.id!!, "BASIC", null, 1),
            reveal(RewardCardKind.SONG, second.id!!, "BASIC", null, 1),
            reveal(RewardCardKind.ARTIST, earlierArtist.id!!, "BASIC", null, 1),
            reveal(RewardCardKind.ARTIST, laterArtist.id!!, "BASIC", null, 1),
        )
        assertThat(cards(me).songCards.map { it.songId }).containsExactlyInAnyOrder(first.id, second.id)
    }

    @Test
    fun `word outside any song deck acquires nothing`() {
        val me = newUser()
        val word = TestWordBuilder(entityManager).forUser(me).build()
        val card = TestFlashcardBuilder(entityManager, clock).forUser(me).ofWord(word).dueAt(clock.instant()).build()

        assertThat(review(me, card)).isEmpty()
        assertThat(pending(me)).isEmpty()
    }

    @Test
    fun `grade rises with leading tiers and pending upgrade clears once seen`() {
        val me = newUser()
        val song = newSong(artist = null)
        val full = studyWord(me, song, "輪郭")
        val chorus = studyWord(me, song, "胸")
        val singalong = studyWord(me, song, "雨")

        assertThat(review(me, full).map { it.grade }).containsExactly("BASIC")
        // 서명 전에 오르면 여전히 획득 연출이다 — 오른 등급으로 받는다.
        assertThat(review(me, chorus)).containsExactly(reveal(RewardCardKind.SONG, song.id!!, "BRONZE", null, 1))

        postJson(me, "/api/reward-cards/songs/${song.id}/issue", mapOf("signature" to signature, "lyricLineIndexes" to listOf(0)))
            .andExpect { status { isNoContent() } }
        assertThat(pending(me)).isEmpty()

        assertThat(review(me, singalong)).containsExactly(reveal(RewardCardKind.SONG, song.id!!, "GOLD", "BRONZE", 1))
        assertThat(pending(me).map { it.seenGrade to it.grade }).containsExactly("BRONZE" to "GOLD")

        postJson(me, "/api/reward-cards/songs/${song.id}/seen", mapOf("grade" to "GOLD"))
            .andExpect { status { isNoContent() } }
        assertThat(pending(me)).isEmpty()

        val songCard = cards(me).songCards.single()
        assertThat(songCard.grade).isEqualTo(SongCardGrade.GOLD)
        assertThat(songCard.signature).isEqualTo(signature)
        assertThat(songCard.lyricLineIndexes).containsExactly(0)
        assertThat(songCard.lyric.map { it.index }).containsExactly(0)
        assertThat(songCard.words.map { it.japanese }).containsExactly("胸", "雨", "輪郭")
        // 막 공부한 단어라 장기기억은 아직 없다. 목표는 tier 단어 3개의 90% 올림.
        assertThat(songCard.nextGoal).isEqualTo(RewardCardGoalResponse(current = 0, total = 3))
        assertThat(songCard.recall).isBetween(0.9, 1.0)
    }

    @Test
    fun `basic card reports progress toward the chorus tier`() {
        val me = newUser()
        val song = newSong(artist = null)
        review(me, studyWord(me, song, "輪郭"))
        studyWord(me, song, "胸")

        val songCard = cards(me).songCards.single()
        assertThat(songCard.grade).isEqualTo(SongCardGrade.BASIC)
        assertThat(songCard.nextGoal).isEqualTo(RewardCardGoalResponse(current = 0, total = 1))
    }

    @Test
    fun `study bootstrap rating acquires the song card`() {
        val me = newUser()
        val artist = newArtist()
        val song = newSong(artist)

        val body = postJson(me, "/api/songs/${song.id}/study-bootstrap", mapOf("rating" to 3))
            .andExpect { status { isOk() } }.andReturn().response.contentAsString
        val response = readBody<SongStudyBootstrapResponse>(body)

        // lead 는 중요도 1위 胸 — 후렴 단계의 유일한 단어라 첫 rating 에 BRONZE 로 받는다.
        assertThat(response.rewardCards.map { it.kind to it.grade }).containsExactly(
            RewardCardKind.SONG to "BRONZE",
            RewardCardKind.ARTIST to "BASIC",
        )
    }

    @Test
    fun `issue validates signature, lyric lines and double issue`() {
        val me = newUser()
        val song = newSong(artist = null)
        review(me, studyWord(me, song, "輪郭"))
        val path = "/api/reward-cards/songs/${song.id}/issue"

        postJson(me, path, mapOf("signature" to emptyList<String>())).andExpect { status { isBadRequest() } }
        postJson(me, path, mapOf("signature" to signature, "lyricLineIndexes" to listOf(9))).andExpect { status { isBadRequest() } }
        postJson(me, path, mapOf("signature" to signature, "lyricLineIndexes" to listOf(0, 1, 2))).andExpect { status { isBadRequest() } }
        postJson(me, "/api/reward-cards/songs/${song.id}/seen", mapOf("grade" to "BASIC")).andExpect { status { isConflict() } }

        postJson(me, path, mapOf("signature" to signature)).andExpect { status { isNoContent() } }
        postJson(me, path, mapOf("signature" to signature)).andExpect { status { isConflict() } }

        mockMvc.put("/api/reward-cards/songs/${song.id}/lyric") {
            header("Authorization", bearer(me))
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsString(mapOf("lyricLineIndexes" to listOf(2, 1)))
        }.andExpect { status { isNoContent() } }
        assertThat(cards(me).songCards.single().lyricLineIndexes).containsExactly(2, 1)

        postJson(newUser(), path, mapOf("signature" to signature)).andExpect { status { isNotFound() } }
    }

    @Test
    fun `artist card joins once the song gets its artist`() {
        val me = newUser()
        val song = newSong(artist = null)
        assertThat(review(me, studyWord(me, song, "輪郭")).map { it.kind }).containsExactly(RewardCardKind.SONG)

        val artist = newArtist()
        song.artistId = artist.id
        entityManager.flush()

        assertThat(review(me, studyWord(me, song, "雨"))).containsExactly(
            reveal(RewardCardKind.ARTIST, artist.id!!, "BASIC", null, 1),
        )
    }

    @Test
    fun `mastered songs raise the artist card and list as recent masters`() {
        val me = newUser()
        val artist = newArtist()
        val song = newSong(artist)
        review(me, studyWord(me, song, "輪郭"))

        val reveals = rewardCardService.achieveSongs(me.id!!, listOf(SongAchievementDto(song.id!!, artist.id, SongCardGrade.MASTER)))

        assertThat(reveals.map { it.kind to it.grade }).containsExactly(
            RewardCardKind.SONG to "MASTER",
            RewardCardKind.ARTIST to "BRONZE",
        )
        val artistCard = cards(me).artistCards.single()
        assertThat(artistCard.masteredSongs.map { it.songId }).containsExactly(song.id)
        assertThat(cards(me).songCards.single().nextGoal).isNull()
    }
}
