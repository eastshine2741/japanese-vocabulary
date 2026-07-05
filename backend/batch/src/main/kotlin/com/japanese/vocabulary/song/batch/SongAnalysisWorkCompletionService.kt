package com.japanese.vocabulary.song.batch

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.song.service.WordCandidateGenerator
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.songanalysis.repository.SongAnalysisWorkRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class SongAnalysisWorkCompletionService(
    private val workRepository: SongAnalysisWorkRepository,
    private val lyricRepository: LyricRepository,
    private val songRepository: SongRepository,
    private val wordCandidateGenerator: WordCandidateGenerator,
) {
    @Transactional
    fun completeWithAnalyzedContent(
        workId: Long,
        workerId: String,
        lyricId: Long,
        analyzedLines: List<AnalyzedLine>,
    ): Boolean {
        val now = Instant.now()
        val work = workRepository.findByIdForUpdate(workId)
            ?: throw BusinessException(ErrorCode.SONG_ANALYSIS_WORK_NOT_FOUND)

        if (work.status != SongAnalysisWorkStatus.RUNNING ||
            work.lockedBy != workerId ||
            work.lockedUntil?.isAfter(now) != true
        ) {
            return false
        }

        val lyric = lyricRepository.findById(lyricId).orElseThrow {
            BusinessException(ErrorCode.LYRIC_NOT_FOUND)
        }
        lyric.analyzedContent = analyzedLines
        val sourceSong = songRepository.findById(lyric.songId).orElse(null)
        val wordCandidates = wordCandidateGenerator.generate(
            title = sourceSong?.title ?: "",
            analyzedLines = analyzedLines,
        )
        lyric.wordCandidates = wordCandidates
        lyricRepository.save(lyric)

        if (work.triggerSource == SongAnalysisTriggerSource.ADMIN && work.songId != null) {
            val song = songRepository.findByIdForUpdate(work.songId!!)
                ?: throw BusinessException(ErrorCode.SONG_NOT_FOUND)
            if (lyric.songId != song.id || work.lyricId != lyric.id) {
                throw BusinessException(ErrorCode.SONG_ANALYSIS_WORK_FAILED)
            }
            val overlappingActiveWriters = workRepository.findBySongIdAndStatusInOrderByCreatedAtAsc(
                song.id!!,
                listOf(SongAnalysisWorkStatus.PENDING, SongAnalysisWorkStatus.RUNNING),
            ).filter { it.id != work.id }
            if (overlappingActiveWriters.isNotEmpty()) {
                throw BusinessException(ErrorCode.SONG_ANALYSIS_WORK_ALREADY_EXISTS)
            }
            song.activeLyricId = lyric.id
            song.youtubeUrl = work.youtubeUrl
            song.updatedAt = now
            songRepository.save(song)
        }

        work.markCompleted(now)
        return true
    }
}
