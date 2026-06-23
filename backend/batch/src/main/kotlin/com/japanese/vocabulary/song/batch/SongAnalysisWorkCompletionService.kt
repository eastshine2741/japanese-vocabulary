package com.japanese.vocabulary.song.batch

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.songanalysis.repository.SongAnalysisWorkRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class SongAnalysisWorkCompletionService(
    private val workRepository: SongAnalysisWorkRepository,
    private val lyricRepository: LyricRepository,
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
        lyricRepository.save(lyric)

        work.markCompleted(now)
        return true
    }
}
