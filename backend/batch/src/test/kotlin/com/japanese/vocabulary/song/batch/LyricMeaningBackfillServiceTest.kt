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
import com.japanese.vocabulary.song.service.WordCandidateGenerator
import com.japanese.vocabulary.test.BatchBaseIntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired

class LyricMeaningBackfillServiceTest : BatchBaseIntegrationTest() {

    @Autowired private lateinit var backfillService: LyricMeaningBackfillService
    @Autowired private lateinit var lyricRepository: LyricRepository
    @Autowired private lateinit var songRepository: SongRepository
    @Autowired private lateinit var wordCandidateGenerator: WordCandidateGenerator

    @Test
    fun `keeps only the first meaning and carries it into word candidates`() {
        val song = songRepository.save(SongEntity(title = "愛を伝えたいだとか", artist = "あいみょん"))
        val text = "愛を君に"
        val lines = listOf(
            AnalyzedLine(
                index = 0,
                koreanLyrics = "사랑을 너에게",
                tokens = listOf(
                    token("愛", PartOfSpeech.NOUN, "사랑, 애정", 0, 1),
                    token("を", PartOfSpeech.PARTICLE, "~을/를", 1, 2),
                    token("君", PartOfSpeech.NOUN, "(친구, 아랫사람을 부르는) 너", 2, 3),
                    token("に", PartOfSpeech.PARTICLE, "~에, ~에게", 3, 4),
                ),
            ),
        )
        val lyric = lyricRepository.save(
            LyricEntity(
                songId = song.id!!,
                lyricType = LyricType.PLAIN,
                rawContent = listOf(LyricLineData(index = 0, startTimeMs = null, text = text)),
                analyzedContent = lines,
                wordCandidates = wordCandidateGenerator.generate(song.title, lines),
            ),
        )
        entityManager.flush()
        entityManager.clear()

        val dryRun = backfillService.backfillPage(page = 0, pageSize = 50, dryRun = true)
        entityManager.flush()
        entityManager.clear()

        assertThat(dryRun.changedTokens).isEqualTo(2)
        assertThat(meanings(lyric.id!!)).containsExactly("사랑, 애정", "~을/를", "(친구, 아랫사람을 부르는) 너", "~에, ~에게")

        val result = backfillService.backfillPage(page = 0, pageSize = 50, dryRun = false)
        entityManager.flush()
        entityManager.clear()

        assertThat(result.changedLyrics).isEqualTo(1)
        assertThat(meanings(lyric.id!!)).containsExactly("사랑", "~을/를", "(친구, 아랫사람을 부르는) 너", "~에")
        val candidates = lyricRepository.findById(lyric.id!!).orElseThrow().wordCandidates!!.candidates
        assertThat(candidates.single { it.surface == "愛" }.koreanText).isEqualTo("사랑")
    }

    private fun meanings(lyricId: Long): List<String?> =
        lyricRepository.findById(lyricId).orElseThrow().analyzedContent!!.single().tokens.map { it.koreanText }

    private fun token(
        surface: String,
        partOfSpeech: PartOfSpeech,
        koreanText: String,
        charStart: Int,
        charEnd: Int,
    ) = Token(
        surface = surface,
        baseForm = surface,
        reading = surface,
        baseFormReading = surface,
        partOfSpeech = partOfSpeech,
        charStart = charStart,
        charEnd = charEnd,
        koreanText = koreanText,
        jlpt = null,
    )
}
