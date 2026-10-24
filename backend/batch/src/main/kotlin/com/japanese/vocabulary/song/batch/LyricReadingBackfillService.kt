package com.japanese.vocabulary.song.batch

import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.SungReading
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.song.service.WordCandidateGenerator
import org.slf4j.LoggerFactory
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * Rewrites the token readings of already-analyzed lyrics with [SungReading], without reanalysis:
 * reanalysis costs LLM calls and can change meanings and segmentation, while only readings are wrong.
 */
@Service
class LyricReadingBackfillService(
    private val lyricRepository: LyricRepository,
    private val songRepository: SongRepository,
    private val wordCandidateGenerator: WordCandidateGenerator,
) {
    private val logger = LoggerFactory.getLogger(LyricReadingBackfillService::class.java)

    data class PageResult(val scannedLyrics: Int, val changedLyrics: Int, val changedTokens: Int)

    @Transactional
    fun backfillPage(page: Int, pageSize: Int, dryRun: Boolean): PageResult {
        val lyrics = lyricRepository.findWordCandidateRegenerateTargets(PageRequest.of(page, pageSize))
        var changedLyrics = 0
        var changedTokens = 0
        for (lyric in lyrics) {
            val analyzed = lyric.analyzedContent ?: continue
            val textByIndex = lyric.rawContent.associate { it.index to it.text }
            var changedInLyric = 0
            val corrected = analyzed.map { line ->
                val text = textByIndex[line.index].orEmpty()
                line.copy(
                    tokens = line.tokens.map { token ->
                        val reading = SungReading.of(
                            token.surface,
                            token.partOfSpeech,
                            token.reading,
                            text.getOrNull(token.charStart - 1),
                        )
                        if (reading == token.reading) return@map token
                        changedInLyric++
                        logger.info(
                            "lyric reading backfill lyricId={} line={} surface={} {} -> {}",
                            lyric.id, line.index, token.surface, token.reading, reading,
                        )
                        token.copy(reading = reading)
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

    /** Word candidates copy a token's reading, so they are regenerated from the corrected lines. */
    private fun save(lyric: LyricEntity, corrected: List<AnalyzedLine>) {
        lyric.analyzedContent = corrected
        if (lyric.wordCandidates != null) {
            val song = songRepository.findById(lyric.songId).orElse(null)
            if (song != null) lyric.wordCandidates = wordCandidateGenerator.generate(song.title, corrected)
        }
        lyricRepository.save(lyric)
    }
}
