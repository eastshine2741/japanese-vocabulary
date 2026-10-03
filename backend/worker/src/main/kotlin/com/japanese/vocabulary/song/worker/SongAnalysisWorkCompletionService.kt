package com.japanese.vocabulary.song.worker

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.song.service.SongAnalysisPreparationService
import com.japanese.vocabulary.song.service.SongAnalysisPreparationService.PreparedLyric
import com.japanese.vocabulary.song.service.WordCandidateGenerator
import com.japanese.vocabulary.songanalysis.dto.SongAnalysisStageRef
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
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
    private val preparationService: SongAnalysisPreparationService,
    private val eventPublisher: ApplicationEventPublisher,
) {
    /**
     * 마지막 단계. 곡·가사 생성, 분석 결과 저장, 작업 완료가 한 트랜잭션이다. 펜스에 걸리면(sweeper 가
     * 이미 FAILED 로 넘겼거나 다른 worker 가 넘겨받았으면) 던져서 곡 생성까지 롤백한다.
     */
    @Transactional
    fun completeWithAnalyzedContent(
        ref: SongAnalysisStageRef,
        preparedLyric: PreparedLyric,
        youtubeUrl: String,
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

        // CREATE_SONG_AND_LYRIC 을 거친 옛 작업은 가사가 이미 있다.
        val lyric = work.lyricId
            ?.let { lyricRepository.findById(it).orElseThrow { BusinessException(ErrorCode.LYRIC_NOT_FOUND) } }
            ?: createLyric(ref, work, preparedLyric, youtubeUrl)
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

    /** 관리자 재분석은 곡의 새 후보 가사만 만든다. 활성 가사와 MV 는 위에서 바꾼다. */
    private fun createLyric(
        ref: SongAnalysisStageRef,
        work: SongAnalysisWorkEntity,
        preparedLyric: PreparedLyric,
        youtubeUrl: String,
    ): LyricEntity {
        val created = if (work.triggerSource == SongAnalysisTriggerSource.ADMIN && work.songId != null) {
            preparationService.createReplacementLyricForSong(work.songId!!, preparedLyric)
        } else {
            preparationService.saveSongWithNewActiveLyric(
                title = work.rawTitle,
                artist = work.rawArtist,
                durationSeconds = work.durationSeconds,
                artworkUrl = work.artworkUrl,
                youtubeUrl = youtubeUrl,
                preparedLyric = preparedLyric,
            )
        }
        val lyric = created.lyric
        if (!workService.attachPlayerReady(ref, requireNotNull(created.song.id), requireNotNull(lyric.id), youtubeUrl)) {
            throw SongAnalysisStageSupersededException(ref)
        }
        return lyric
    }
}
