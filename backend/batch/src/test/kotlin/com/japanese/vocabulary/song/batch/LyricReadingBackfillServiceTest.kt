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

class LyricReadingBackfillServiceTest : BatchBaseIntegrationTest() {

    @Autowired private lateinit var backfillService: LyricReadingBackfillService
    @Autowired private lateinit var lyricRepository: LyricRepository
    @Autowired private lateinit var songRepository: SongRepository
    @Autowired private lateinit var wordCandidateGenerator: WordCandidateGenerator

    @Test
    fun `rewrites token readings to what is sung and carries them into word candidates`() {
        val song = songRepository.save(SongEntity(title = "きゅうくらりん", artist = "いよわ"))
        val text = "8時過ぎ みんなには"
        val lines = listOf(
            AnalyzedLine(
                index = 0,
                koreanLyrics = "8시 넘어 모두에게는",
                tokens = listOf(
                    token("時", "時", "トキ", PartOfSpeech.NOUN, "때", 1, 2),
                    token("過ぎ", "過ぎる", "スギ", PartOfSpeech.VERB, "지나다", 2, 4),
                    token("みんな", "みんな", "ミンナ", PartOfSpeech.NOUN, "모두", 5, 8),
                    token("には", "には", "ニハ", PartOfSpeech.EXPRESSION, "~에게는", 8, 10),
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
        assertThat(readings(lyric.id!!)).containsExactly("トキ", "スギ", "ミンナ", "ニハ")

        val result = backfillService.backfillPage(page = 0, pageSize = 50, dryRun = false)
        entityManager.flush()
        entityManager.clear()

        assertThat(result.changedLyrics).isEqualTo(1)
        assertThat(readings(lyric.id!!)).containsExactly("ジ", "スギ", "ミンナ", "ニワ")
        val candidates = lyricRepository.findById(lyric.id!!).orElseThrow().wordCandidates!!.candidates
        assertThat(candidates.single { it.surface == "時" }.reading).isEqualTo("ジ")
    }

    private fun readings(lyricId: Long): List<String?> =
        lyricRepository.findById(lyricId).orElseThrow().analyzedContent!!.single().tokens.map { it.reading }

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
