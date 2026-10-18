package com.japanese.vocabulary.rewardcard.batch

import com.japanese.vocabulary.deck.entity.DeckEntity
import com.japanese.vocabulary.deck.entity.DeckWordEntity
import com.japanese.vocabulary.rewardcard.dto.SongAchievementDto
import com.japanese.vocabulary.rewardcard.model.ArtistCardGrade
import com.japanese.vocabulary.rewardcard.model.SongCardGrade
import com.japanese.vocabulary.rewardcard.repository.ArtistCardRepository
import com.japanese.vocabulary.rewardcard.repository.SongCardRepository
import com.japanese.vocabulary.rewardcard.service.RewardCardService
import com.japanese.vocabulary.song.entity.ArtistEntity
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.model.LyricWordCandidates
import com.japanese.vocabulary.song.model.WordCandidate
import com.japanese.vocabulary.song.model.WordScoreComponents
import com.japanese.vocabulary.test.BatchBaseIntegrationTest
import com.japanese.vocabulary.test.fixtures.TestFlashcardBuilder
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import com.japanese.vocabulary.test.fixtures.TestUserBuilder
import com.japanese.vocabulary.test.fixtures.TestWordBuilder
import com.japanese.vocabulary.user.entity.UserEntity
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import java.time.Duration

class RewardCardBackfillTaskTest : BatchBaseIntegrationTest() {

    @Autowired private lateinit var task: RewardCardBackfillTask
    @Autowired private lateinit var pushTask: RewardCardBackfillPushTask
    @Autowired private lateinit var rewardCardService: RewardCardService
    @Autowired private lateinit var songCardRepository: SongCardRepository
    @Autowired private lateinit var artistCardRepository: ArtistCardRepository

    @Test
    fun `fills saved songs with an issued unsigned card per grade, earlier deck first`() {
        val artist = ArtistEntity(appleMusicId = "am-${System.nanoTime()}", name = "YOASOBI").also { entityManager.persist(it) }
        val song = newSong(artist)
        val early = TestUserBuilder(entityManager).build()
        val late = TestUserBuilder(entityManager).build()
        studyWord(early, song, "胸", reviewed = true)
        studyWord(late, song, "雨", reviewed = false)

        val dry = task.dryRun()
        assertThat(songCards(early, song)).isEmpty()

        val result = task.backfill()
        assertThat(dry.newSongCards).isEqualTo(result.newSongCards)
        assertThat(dry.newArtistCards).isEqualTo(result.newArtistCards)

        assertThat(result.newSongCards).isEqualTo(3)
        val earlyCards = songCards(early, song)
        val lateCards = songCards(late, song)
        assertThat(earlyCards.map { it.grade to it.acquiredSeq }).containsExactly(SongCardGrade.BASIC to 1, SongCardGrade.BRONZE to 1)
        assertThat(earlyCards).allSatisfy {
            assertThat(it.isIssued).isTrue()
            assertThat(it.signature).isEmpty()
        }
        assertThat(lateCards.map { it.grade to it.acquiredSeq }).containsExactly(SongCardGrade.BASIC to 2)
        val artistCard = artistCardRepository.findByUserIdAndArtistIdIn(early.id!!, listOf(artist.id!!)).single()
        assertThat(artistCard.grade).isEqualTo(ArtistCardGrade.BASIC)
        assertThat(artistCard.isIssued).isTrue()
        assertThat(result.failed).isZero()

        assertThat(task.backfill().newSongCards).isZero()
    }

    @Test
    fun `push targets only users whose cards came from backfill, with songs in fill order`() {
        val first = newSong(artist = null)
        val second = newSong(artist = null)
        val filled = TestUserBuilder(entityManager).build()
        studyWord(filled, first, "胸", reviewed = true)
        studyWord(filled, second, "雨", reviewed = false)
        val rated = TestUserBuilder(entityManager).build()
        val ratedSong = newSong(artist = null)
        // 플래그를 켠 뒤 rating 으로 받아 서명까지 한 카드는 채운 카드가 아니다.
        rewardCardService.achieveSongs(rated.id!!, listOf(SongAchievementDto(ratedSong.id!!, null, SongCardGrade.BASIC)))
        entityManager.flush()
        val ratedCard = songCardRepository.findByUserIdAndSongIdIn(rated.id!!, listOf(ratedSong.id!!)).single()
        clock.advance(Duration.ofMinutes(1))
        rewardCardService.issueSongCard(rated.id!!, ratedCard.id!!, listOf("M0 0"), emptyList())

        task.backfill()

        val backfilled = rewardCardService.backfilledSongs()
        assertThat(backfilled).doesNotContainKey(rated.id!!)
        assertThat(backfilled.getValue(filled.id!!).map { it.songId }).containsExactly(first.id!!, second.id!!)
        val message = pushTask.messages().single { it.userId == filled.id }
        assertThat(message.songId).isEqualTo(RewardCardBackfillPushTask.headline(backfilled.getValue(filled.id!!)))
        assertThat(message.body).contains("외 1곡을 카드로")
    }

    @Test
    fun `grades with 14-day long-term even while the reward-card flag is off`() {
        val me = TestUserBuilder(entityManager).build()
        val song = newSong(artist = null)
        val deck = DeckEntity(userId = me.id!!, songId = song.id!!, title = song.title, description = song.artist)
            .also { entityManager.persist(it) }
        // 완곡까지 다 봤고 stability 10일 — 7일 기준이면 MASTER, 14일 기준이면 GOLD 다.
        for (japanese in listOf("胸", "雨", "輪郭")) {
            val word = TestWordBuilder(entityManager).forUser(me).withJapaneseText(japanese).build()
            entityManager.persist(DeckWordEntity(deckId = deck.id!!, wordId = word.id!!))
            TestFlashcardBuilder(entityManager, clock).forUser(me).ofWord(word)
                .withState(1).withStability(10.0).lastReviewedAt(clock.instant()).dueAt(clock.instant()).build()
        }
        entityManager.flush()

        task.backfill()

        assertThat(songCards(me, song).map { it.grade }.last()).isEqualTo(SongCardGrade.GOLD)
    }

    @Test
    fun `push names the highest grade song, the later one on a tie`() {
        val cards = listOf(
            SongAchievementDto(1, null, SongCardGrade.BRONZE),
            SongAchievementDto(2, null, SongCardGrade.SILVER),
            SongAchievementDto(3, null, SongCardGrade.SILVER),
        )
        assertThat(RewardCardBackfillPushTask.headline(cards)).isEqualTo(3)
        assertThat(RewardCardBackfillPushTask.body("하루", "夜に駆ける", 2))
            .isEqualTo("하루님께 「夜に駆ける」 외 2곡을 카드로 만들어드렸어요. 최신 버전으로 업데이트 후 확인해보세요")
        assertThat(RewardCardBackfillPushTask.body("하루", "夜に駆ける", 0))
            .isEqualTo("하루님께 「夜に駆ける」 카드를 만들어드렸어요. 최신 버전으로 업데이트 후 확인해보세요")
        assertThat(RewardCardBackfillPushTask.body("하루", "あ".repeat(25), 0)).contains("「${"あ".repeat(20)}…」")
    }

    @Test
    fun `cards waiting for their reveal are issued silently`() {
        val song = newSong(artist = null)
        val user = TestUserBuilder(entityManager).build()
        studyWord(user, song, "胸", reviewed = true)
        // 구버전 앱으로 rating 해 연출을 기다리는 카드.
        rewardCardService.achieveSongs(user.id!!, listOf(SongAchievementDto(song.id!!, null, SongCardGrade.BRONZE)))
        entityManager.flush()
        assertThat(rewardCardService.pending(user.id!!)).isNotEmpty()

        assertThat(task.dryRun().silencedReveals).isGreaterThanOrEqualTo(1)
        assertThat(rewardCardService.pending(user.id!!)).isNotEmpty()

        task.backfill()

        assertThat(rewardCardService.pending(user.id!!)).isEmpty()
        assertThat(songCards(user, song).map { it.signature }).containsOnly(emptyList())
    }

    private fun songCards(user: UserEntity, song: SongEntity) =
        songCardRepository.findByUserIdAndSongIdIn(user.id!!, listOf(song.id!!)).sortedBy { it.grade }

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

    private fun studyWord(user: UserEntity, song: SongEntity, japanese: String, reviewed: Boolean) {
        val deck = DeckEntity(userId = user.id!!, songId = song.id!!, title = song.title, description = song.artist)
            .also { entityManager.persist(it) }
        val word = TestWordBuilder(entityManager).forUser(user).withJapaneseText(japanese).build()
        entityManager.persist(DeckWordEntity(deckId = deck.id!!, wordId = word.id!!))
        val card = TestFlashcardBuilder(entityManager, clock).forUser(user).ofWord(word).dueAt(clock.instant()).build()
        if (reviewed) card.lastReview = clock.instant()
        entityManager.flush()
    }
}
