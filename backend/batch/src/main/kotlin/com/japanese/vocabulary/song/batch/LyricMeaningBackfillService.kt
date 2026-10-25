package com.japanese.vocabulary.song.batch

import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.KoreanMeaning
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.song.service.WordCandidateGenerator
import org.slf4j.LoggerFactory
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * Cuts each token's Korean meaning down to its first one with [KoreanMeaning], without reanalysis:
 * reanalysis costs LLM calls and can change translations and segmentation, while only the meaning lists are wrong.
 */
@Service
class LyricMeaningBackfillService(
    private val lyricRepository: LyricRepository,
    private val songRepository: SongRepository,
    private val wordCandidateGenerator: WordCandidateGenerator,
) {
    private val logger = LoggerFactory.getLogger(LyricMeaningBackfillService::class.java)

    data class PageResult(val scannedLyrics: Int, val changedLyrics: Int, val changedTokens: Int)

    @Transactional
    fun backfillPage(page: Int, pageSize: Int, dryRun: Boolean): PageResult {
        val lyrics = lyricRepository.findWordCandidateRegenerateTargets(PageRequest.of(page, pageSize))
        var changedLyrics = 0
        var changedTokens = 0
        for (lyric in lyrics) {
            val analyzed = lyric.analyzedContent ?: continue
            var changedInLyric = 0
            val corrected = analyzed.map { line ->
                line.copy(
                    tokens = line.tokens.map { token ->
                        val meaning = token.koreanText ?: return@map token
                        val first = KoreanMeaning.first(meaning)
                        if (first == meaning) return@map token
                        changedInLyric++
                        logger.info(
                            "lyric meaning backfill lyricId={} line={} surface={} {} -> {}",
                            lyric.id, line.index, token.surface, meaning, first,
                        )
                        token.copy(koreanText = first)
                    },
                )
            }
            if (changedInLyric == 0) continue
            changedLyrics++
            changedTokens += changedInLyric
            if (!dryRun) save(lyric, corrected)
        }
        return PageResult(lyrics.size, changedLyrics, changedTokens)
    }

    /** Word candidates copy a token's meaning, so they are regenerated from the corrected lines. */
    private fun save(lyric: LyricEntity, corrected: List<AnalyzedLine>) {
        lyric.analyzedContent = corrected
        if (lyric.wordCandidates != null) {
            val song = songRepository.findById(lyric.songId).orElse(null)
            if (song != null) lyric.wordCandidates = wordCandidateGenerator.generate(song.title, corrected)
        }
        lyricRepository.save(lyric)
    }
}
