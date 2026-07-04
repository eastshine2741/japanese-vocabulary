package com.japanese.vocabulary.song.batch

import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.song.service.WordCandidateGenerator
import org.slf4j.LoggerFactory
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class SongWordCandidateBackfillService(
    private val lyricRepository: LyricRepository,
    private val songRepository: SongRepository,
    private val wordCandidateGenerator: WordCandidateGenerator,
) {
    private val logger = LoggerFactory.getLogger(SongWordCandidateBackfillService::class.java)

    data class Result(
        val dryRun: Boolean,
        val songId: Long?,
        val scannedLyrics: Int,
        val updatedLyrics: Int,
        val skippedAlreadyPresent: Int,
        val skippedMissingAnalyzedContent: Int,
        val skippedMissingSong: Int,
        val totalCandidatesGenerated: Int,
        val lyrics: List<Item>,
    )

    data class Item(
        val lyricId: Long,
        val songId: Long,
        val candidateCount: Int,
        val updated: Boolean,
    )

    @Transactional
    fun backfill(songId: Long?, limit: Int, dryRun: Boolean): Result {
        val normalizedLimit = limit.coerceIn(1, 1000)
        val targets = findTargets(songId, normalizedLimit)
        val songsById = songRepository.findAllById(targets.map { it.songId }.distinct())
            .associateBy { it.id!! }
        val items = mutableListOf<Item>()
        val lyricsToSave = mutableListOf<LyricEntity>()
        var skippedAlreadyPresent = 0
        var skippedMissingAnalyzedContent = 0
        var skippedMissingSong = 0
        var totalCandidatesGenerated = 0

        for (lyric in targets) {
            if (lyric.wordCandidates != null) {
                skippedAlreadyPresent++
                continue
            }

            val analyzedContent = lyric.analyzedContent
            if (analyzedContent.isNullOrEmpty()) {
                skippedMissingAnalyzedContent++
                continue
            }

            val song = songsById[lyric.songId]
            if (song == null) {
                skippedMissingSong++
                continue
            }

            val wordCandidates = wordCandidateGenerator.generate(
                title = song.title,
                analyzedLines = analyzedContent,
            )
            totalCandidatesGenerated += wordCandidates.candidates.size
            items += Item(
                lyricId = lyric.id!!,
                songId = lyric.songId,
                candidateCount = wordCandidates.candidates.size,
                updated = !dryRun,
            )

            if (!dryRun) {
                lyric.wordCandidates = wordCandidates
                lyricsToSave += lyric
            }
        }

        if (!dryRun && lyricsToSave.isNotEmpty()) {
            lyricRepository.saveAll(lyricsToSave)
        }

        logger.info(
            "song word-candidate backfill dryRun={} songId={} scanned={} updated={} generatedCandidates={}",
            dryRun,
            songId,
            targets.size,
            lyricsToSave.size,
            totalCandidatesGenerated,
        )

        return Result(
            dryRun = dryRun,
            songId = songId,
            scannedLyrics = targets.size,
            updatedLyrics = lyricsToSave.size,
            skippedAlreadyPresent = skippedAlreadyPresent,
            skippedMissingAnalyzedContent = skippedMissingAnalyzedContent,
            skippedMissingSong = skippedMissingSong,
            totalCandidatesGenerated = totalCandidatesGenerated,
            lyrics = items,
        )
    }

    private fun findTargets(songId: Long?, limit: Int): List<LyricEntity> =
        if (songId != null) {
            lyricRepository.findAllBySongIdOrderByCreatedAtDesc(songId)
        } else {
            lyricRepository.findWordCandidateBackfillTargets(PageRequest.of(0, limit))
        }
}
