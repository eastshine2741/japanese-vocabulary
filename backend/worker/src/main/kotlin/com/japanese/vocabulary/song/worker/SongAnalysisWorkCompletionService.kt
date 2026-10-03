package com.japanese.vocabulary.song.worker

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.song.service.WordCandidateGenerator
import com.japanese.vocabulary.songanalysis.dto.SongAnalysisStageRef
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.songanalysis.repository.SongAnalysisWorkRepository
import com.japanese.vocabulary.songanalysis.event.SongAnalysisCompletedEvent
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
import org.springframework.context.ApplicationEventPublisher
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class SongAnalysisWorkCompletionService(
    private val workRepository: SongAnalysisWorkRepository,
    private val workService: SongAnalysisWorkService,
    private val lyricRepository: LyricRepository,
    private val songRepository: SongRepository,
    private val wordCandidateGenerator: WordCandidateGenerator,
    private val eventPublisher: ApplicationEventPublisher,
) {
    /**
     * 마지막 단계. 분석 결과 저장과 작업 완료가 한 트랜잭션이다. 펜스에 걸리면(sweeper 가 이미
     * FAILED 로 넘겼거나 다른 worker 가 넘겨받았으면) 던져서 가사 쓰기까지 롤백한다.
     */
    @Transactional
    fun completeWithAnalyzedContent(
        ref: SongAnalysisStageRef,
        lyricId: Long,
        analyzedLines: List<AnalyzedLine>,
        output: String?,
    ) {
        val now = Instant.now()
        val workId = ref.workId
        val work = workRepository.findByIdForUpdate(workId)
            ?: throw BusinessException(ErrorCode.SONG_ANALYSIS_WORK_NOT_FOUND)

        // sweeper 가 이미 FAILED 로 넘긴 행에 뒤늦게 결과를 쓰는 것을 막는다. 아래 completeStage 가
        // 다시 확인하지만, 가사를 쓰기 전에 걸러 두면 롤백할 일이 줄어든다.
        if (work.status != SongAnalysisWorkStatus.RUNNING) throw SongAnalysisStageSupersededException(ref)

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

        if (!workService.completeStage(ref, output)) throw SongAnalysisStageSupersededException(ref)
        eventPublisher.publishEvent(SongAnalysisCompletedEvent(workId, lyric.songId))
    }
}
