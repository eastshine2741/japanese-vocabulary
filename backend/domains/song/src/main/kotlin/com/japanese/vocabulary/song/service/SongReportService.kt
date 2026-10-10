package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.SongReportEntity
import com.japanese.vocabulary.song.entity.SongReportStatus
import com.japanese.vocabulary.song.event.SongReportApprovedEvent
import com.japanese.vocabulary.song.model.SongEditOp
import com.japanese.vocabulary.song.model.SongReportTarget
import com.japanese.vocabulary.song.model.SongReportTargetKind
import com.japanese.vocabulary.song.model.SongReportType
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongReportRepository
import com.japanese.vocabulary.song.repository.SongRepository
import org.springframework.context.ApplicationEventPublisher
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant

@Service
class SongReportService(
    private val songRepository: SongRepository,
    private val lyricRepository: LyricRepository,
    private val songReportRepository: SongReportRepository,
    private val songEditApplier: SongEditApplier,
    private val wordCandidateGenerator: WordCandidateGenerator,
    private val eventPublisher: ApplicationEventPublisher,
    private val clock: Clock,
) {
    @Transactional
    fun submit(userId: Long, songId: Long, type: SongReportType, target: SongReportTarget?, suggestion: String?): SongReportEntity {
        val song = songRepository.findById(songId).orElseThrow { BusinessException(ErrorCode.SONG_NOT_FOUND) }
        val lyric = song.activeLyricId?.let { lyricRepository.findById(it).orElse(null) }
        val storedTarget = resolveTarget(type.targetKind, target, lyric)

        val trimmed = suggestion?.trim()?.takeIf { it.isNotEmpty() }
        if (trimmed == null && type.suggestionRequired) throw BusinessException(ErrorCode.SONG_REPORT_SUGGESTION_REQUIRED)
        if (trimmed != null && trimmed.length > MAX_SUGGESTION_LENGTH) throw BusinessException(ErrorCode.SONG_REPORT_SUGGESTION_TOO_LONG)

        return songReportRepository.save(
            SongReportEntity(
                userId = userId,
                songId = songId,
                lyricId = lyric?.id,
                type = type,
                reportTarget = storedTarget,
                reportSuggestion = trimmed,
            ),
        )
    }

    /** 수정과 상태 변경이 한 트랜잭션이다. 수정 하나라도 불변식을 깨면 IllegalArgumentException 으로 전부 되돌린다. */
    @Transactional
    fun approve(reportId: Long, ops: List<SongEditOp>, note: String?): SongReportEntity {
        val report = lockPending(reportId)
        val song = songRepository.findByIdForUpdate(report.songId) ?: throw BusinessException(ErrorCode.SONG_NOT_FOUND)
        val lyric = song.activeLyricId?.let { lyricRepository.findById(it).orElse(null) }

        val result = songEditApplier.apply(song, lyric, ops)
        report.approve(result.changes, note, Instant.now(clock))

        song.youtubeUrl = result.youtubeUrl
        if (lyric != null && result.lyricChanged) {
            lyric.rawContent = result.rawContent ?: lyric.rawContent
            lyric.analyzedContent = result.analyzedContent
            lyric.wordCandidates = result.analyzedContent?.let { wordCandidateGenerator.generate(song.title, it) }
        }
        eventPublisher.publishEvent(SongReportApprovedEvent(requireNotNull(report.id), report.userId, report.songId))
        return report
    }

    @Transactional
    fun reject(reportId: Long, note: String?): SongReportEntity {
        val report = lockPending(reportId)
        report.reject(note, Instant.now(clock))
        return report
    }

    @Transactional(readOnly = true)
    fun contributorUserIds(songId: Long): List<Long> = songReportRepository.findContributorUserIds(songId)

    private fun lockPending(reportId: Long): SongReportEntity =
        (songReportRepository.findByIdForUpdate(reportId) ?: throw BusinessException(ErrorCode.SONG_REPORT_NOT_FOUND))
            .also { if (it.status != SongReportStatus.PENDING) throw BusinessException(ErrorCode.SONG_REPORT_NOT_PENDING) }

    private fun resolveTarget(kind: SongReportTargetKind, target: SongReportTarget?, lyric: LyricEntity?): SongReportTarget? {
        val given = target?.takeIf { it.lineIndex != null || it.charStart != null || it.charEnd != null }
        if (kind == SongReportTargetKind.NONE) {
            if (given != null) throw BusinessException(ErrorCode.SONG_REPORT_INVALID_TARGET)
            return null
        }
        val lineIndex = given?.lineIndex ?: throw BusinessException(ErrorCode.SONG_REPORT_INVALID_TARGET)
        if (lyric == null) throw BusinessException(ErrorCode.LYRIC_NOT_FOUND)
        if (lyric.rawContent.none { it.index == lineIndex }) throw BusinessException(ErrorCode.SONG_REPORT_INVALID_TARGET)

        if (kind == SongReportTargetKind.LINE) {
            if (given.charStart != null || given.charEnd != null) throw BusinessException(ErrorCode.SONG_REPORT_INVALID_TARGET)
            return SongReportTarget(lineIndex = lineIndex)
        }
        val token = lyric.analyzedContent.orEmpty()
            .firstOrNull { it.index == lineIndex }
            ?.tokens
            ?.firstOrNull { it.charStart == given.charStart && it.charEnd == given.charEnd }
            ?: throw BusinessException(ErrorCode.SONG_REPORT_INVALID_TARGET)
        return SongReportTarget(lineIndex, token.charStart, token.charEnd, token.surface)
    }

    companion object {
        const val MAX_SUGGESTION_LENGTH = 1000
    }
}
