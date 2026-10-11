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

class RewardCardBackfillTaskTest : BatchBaseIntegrationTest() {

    @Autowired private lateinit var task: RewardCardBackfillTask
    @Autowired private lateinit var rewardCardService: RewardCardService
    @Autowired private lateinit var songCardRepository: SongCardRepository
    @Autowired private lateinit var artistCardRepository: ArtistCardRepository

    @Test
    fun `fills saved songs as issued unsigned cards, earlier deck first`() {
        val artist = ArtistEntity(appleMusicId = "am-${System.nanoTime()}", name = "YOASOBI").also { entityManager.persist(it) }
        val song = newSong(artist)
        val early = TestUserBuilder(entityManager).build()
        val late = TestUserBuilder(entityManager).build()
        studyWord(early, song, "胸", reviewed = true)
        studyWord(late, song, "雨", reviewed = false)

        val dry = task.dryRun()
        assertThat(songCardRepository.findByUserIdAndSongId(early.id!!, song.id!!)).isNull()

        val result = task.backfill(push = false)
        assertThat(dry.newSongCards).isEqualTo(result.newSongCards)
        assertThat(dry.newArtistCards).isEqualTo(result.newArtistCards)

        val earlyCard = songCardRepository.findByUserIdAndSongId(early.id!!, song.id!!)!!
        val lateCard = songCardRepository.findByUserIdAndSongId(late.id!!, song.id!!)!!
        assertThat(earlyCard.grade).isEqualTo(SongCardGrade.BRONZE)
        assertThat(earlyCard.seenGrade).isEqualTo(SongCardGrade.BRONZE)
        assertThat(earlyCard.signature).isEmpty()
        assertThat(lateCard.grade).isEqualTo(SongCardGrade.BASIC)
        assertThat(earlyCard.acquiredSeq).isLessThan(lateCard.acquiredSeq)
        val artistCard = artistCardRepository.findByUserIdAndArtistId(early.id!!, artist.id!!)!!
        assertThat(artistCard.grade).isEqualTo(ArtistCardGrade.BASIC)
        assertThat(artistCard.seenGrade).isEqualTo(ArtistCardGrade.BASIC)
        assertThat(result.failed).isZero()

        // 다시 돌려도 새 카드가 없어 알리지 않는다.
        assertThat(task.backfill(push = false).newSongCards).isZero()
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

        task.backfill(push = false)

        assertThat(rewardCardService.pending(user.id!!)).isEmpty()
        assertThat(songCardRepository.findByUserIdAndSongId(user.id!!, song.id!!)!!.signature).isEmpty()
    }

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
