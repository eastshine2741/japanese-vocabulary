package com.japanese.vocabulary.song.batch

import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.song.model.Token
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.test.BatchBaseIntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired

class LyricWordCandidateBackfillServiceTest : BatchBaseIntegrationTest() {

    @Autowired private lateinit var backfillService: LyricWordCandidateBackfillService
    @Autowired private lateinit var lyricRepository: LyricRepository
    @Autowired private lateinit var songRepository: SongRepository

    @Test
    fun `backfills word candidates from existing analyzed content`() {
        val song = songRepository.save(SongEntity(title = "走る夜", artist = "歌手"))
        val lyric = lyricRepository.save(
            LyricEntity(
                songId = song.id!!,
                lyricType = LyricType.PLAIN,
                rawContent = listOf(LyricLineData(index = 0, startTimeMs = null, text = "夜を走る")),
                analyzedContent = listOf(
                    AnalyzedLine(
                        index = 0,
                        koreanLyrics = "밤을 달리다",
                        koreanPronounciation = null,
                        tokens = listOf(
                            token("夜", "夜", "よる", PartOfSpeech.NOUN, "밤", 0, 1),
                            token("走る", "走る", "はしる", PartOfSpeech.VERB, "달리다", 2, 4),
                        ),
                    ),
                ),
                wordCandidates = null,
            ),
        )
        entityManager.flush()
        entityManager.clear()

        val dryRun = backfillService.backfill(songId = song.id, limit = 100, dryRun = true)
        entityManager.flush()
        entityManager.clear()

        assertThat(dryRun.updatedLyrics).isZero()
        assertThat(dryRun.lyrics).singleElement().satisfies({ item ->
            assertThat(item.lyricId).isEqualTo(lyric.id)
            assertThat(item.candidateCount).isEqualTo(2)
            assertThat(item.updated).isFalse()
        })
        assertThat(lyricRepository.findById(lyric.id!!).orElseThrow().wordCandidates).isNull()

        val result = backfillService.backfill(songId = song.id, limit = 100, dryRun = false)
        entityManager.flush()
        entityManager.clear()

        val reloaded = lyricRepository.findById(lyric.id!!).orElseThrow()
        assertThat(result.updatedLyrics).isEqualTo(1)
        assertThat(result.totalCandidatesGenerated).isEqualTo(2)
        assertThat(reloaded.wordCandidates).isNotNull
        assertThat(reloaded.wordCandidates!!.candidates.map { it.japanese }).containsExactly("夜", "走る")
        assertThat(reloaded.wordCandidates!!.lineCandidates["0"]).containsExactly(0, 1)
    }

    private fun token(
        surface: String,
        baseForm: String,
        reading: String,
        partOfSpeech: PartOfSpeech,
        koreanText: String,
        charStart: Int,
        charEnd: Int,
    ) = Token(
        surface = surface,
        baseForm = baseForm,
        reading = reading,
        baseFormReading = reading,
        partOfSpeech = partOfSpeech,
        charStart = charStart,
        charEnd = charEnd,
        koreanText = koreanText,
        jlpt = null,
    )
}
