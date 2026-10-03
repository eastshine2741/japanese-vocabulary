package com.japanese.vocabulary.songanalysis.service

import org.springframework.stereotype.Service
import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.songanalysis.dto.SongAnalysisWorkDto
import com.japanese.vocabulary.songanalysis.dto.toDto
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStage
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.songanalysis.event.SongAnalysisWorkQueuedEvent
import com.japanese.vocabulary.songanalysis.repository.SongAnalysisWorkRepository
import org.springframework.context.ApplicationEventPublisher
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.annotation.Propagation
import org.springframework.data.domain.Pageable
import java.time.Instant

@Service
class SongAnalysisWorkService(
    private val songAnalysisWorkRepository: SongAnalysisWorkRepository,
    private val eventPublisher: ApplicationEventPublisher,
) {

    @Transactional
    fun createOrReuse(
        title: String,
        artist: String,
        durationSeconds: Int? = null,
        artworkUrl: String? = null,
        triggerSource: SongAnalysisTriggerSource = SongAnalysisTriggerSource.USER_APP,
        createdByUserId: Long? = null,
    ): SongAnalysisWorkDto {
        val activeDedupKey = buildActiveDedupKey(title, artist)

        songAnalysisWorkRepository.findByActiveDedupKey(activeDedupKey)?.let {
            return it.toDto()
        }

        val work = SongAnalysisWorkEntity(
            rawTitle = title,
            rawArtist = artist,
            durationSeconds = durationSeconds,
            artworkUrl = artworkUrl,
            activeDedupKey = activeDedupKey,
            triggerSource = triggerSource,
            createdByUserId = createdByUserId,
        )

        val saved = try {
            songAnalysisWorkRepository.saveAndFlush(work)
        } catch (_: DataIntegrityViolationException) {
            throw BusinessException(ErrorCode.SONG_ANALYSIS_WORK_ALREADY_EXISTS)
        }
        eventPublisher.publishEvent(SongAnalysisWorkQueuedEvent(saved.id!!))
        return saved.toDto()
    }

    /** 이 곡의 분석을 끝낸 가장 최근 작업. 이미 분석된 곡을 다시 요청받았을 때 새 작업 대신 돌려준다. */
    @Transactional(readOnly = true)
    fun findLatestCompletedForSong(songId: Long): SongAnalysisWorkDto? {
        return songAnalysisWorkRepository.findBySongIdOrderByCreatedAtDesc(songId)
            .firstOrNull { it.status == SongAnalysisWorkStatus.COMPLETED }
            ?.toDto()
    }

    @Transactional(readOnly = true)
    fun getById(id: Long): SongAnalysisWorkDto {
        return songAnalysisWorkRepository.findById(id).orElse(null)?.toDto()
            ?: throw BusinessException(ErrorCode.SONG_ANALYSIS_WORK_NOT_FOUND)
    }

    /** Caller keeps the work lock until its subscription change has finished. */
    @Transactional(propagation = Propagation.MANDATORY)
    fun getByIdForUpdate(workId: Long): SongAnalysisWorkDto = getEntityForUpdate(workId).toDto()

    @Transactional(propagation = Propagation.MANDATORY)
    fun getLatestForLyricForUpdate(songId: Long, lyricId: Long): SongAnalysisWorkDto? {
        val id = songAnalysisWorkRepository.findLatestIdsForLyric(songId, lyricId, Pageable.ofSize(1))
            .firstOrNull() ?: return null
        return songAnalysisWorkRepository.findByIdForUpdate(id)?.toDto()
    }

    /**
     * 큐 메시지 하나가 가리키는 작업을 잡는다. 같은 메시지가 두 번 와도 PENDING 인 행만 잡히므로
     * 두 번째 배달은 null 을 받고 조용히 ack 된다.
     */
    @Transactional
    fun claim(workId: Long, workerId: String, lockUntil: Instant): SongAnalysisWorkEntity? {
        val work = songAnalysisWorkRepository.findByIdForUpdate(workId) ?: return null
        if (work.status != SongAnalysisWorkStatus.PENDING) return null
        work.status = SongAnalysisWorkStatus.RUNNING
        work.lockedBy = workerId
        work.lockedUntil = lockUntil
        work.currentStage = null
        work.clearFailure()
        return songAnalysisWorkRepository.saveAndFlush(work)
    }

    /** 메시지가 유실돼 PENDING 으로 남은 작업. sweeper 가 다시 큐에 넣는다. */
    @Transactional(readOnly = true)
    fun findStalePendingIds(olderThan: Instant, limit: Int): List<Long> =
        songAnalysisWorkRepository.findStalePendingIds(olderThan, Pageable.ofSize(limit))


    @Transactional
    fun failExpiredRunning(limit: Int): Int {
        val expired = songAnalysisWorkRepository.findExpiredRunningForUpdate(
            Instant.now(),
            org.springframework.data.domain.Pageable.ofSize(limit),
        )
        val now = Instant.now()
        expired.forEach { work ->
            work.markFailed(
                ErrorCode.SONG_ANALYSIS_WORK_TIMEOUT.name,
                ErrorCode.SONG_ANALYSIS_WORK_TIMEOUT.message,
                now,
            )
        }
        songAnalysisWorkRepository.saveAllAndFlush(expired)
        return expired.size
    }

    @Transactional
    fun markStage(workId: Long, workerId: String, stage: SongAnalysisWorkStage): Boolean {
        val work = getEntityForUpdate(workId)
        val now = Instant.now()
        if (!work.isOwnedRunningBy(workerId, now)) return false
        work.currentStage = stage
        return true
    }

    @Transactional
    fun markPlayerReady(workId: Long, workerId: String, songId: Long, lyricId: Long, youtubeUrl: String?): Boolean {
        val work = getEntityForUpdate(workId)
        if (!work.isOwnedRunningBy(workerId, Instant.now())) return false
        work.attachPlayerReady(songId, lyricId, youtubeUrl, Instant.now())
        return true
    }

    @Transactional
    fun markCompleted(workId: Long, workerId: String): Boolean {
        val work = getEntityForUpdate(workId)
        if (!work.isOwnedRunningBy(workerId, Instant.now())) return false
        work.markCompleted(Instant.now())
        return true
    }

    @Transactional
    fun markFailed(workId: Long, workerId: String, code: String, message: String?): Boolean {
        val work = getEntityForUpdate(workId)
        if (!work.isOwnedRunningBy(workerId, Instant.now())) return false
        work.markFailed(code, message, Instant.now())
        return true
    }

    @Transactional(readOnly = true)
    fun isOwnedRunning(workId: Long, workerId: String): Boolean {
        return getEntity(workId).isOwnedRunningBy(workerId, Instant.now())
    }

    private fun getEntity(workId: Long): SongAnalysisWorkEntity {
        return songAnalysisWorkRepository.findById(workId).orElseThrow {
            BusinessException(ErrorCode.SONG_ANALYSIS_WORK_NOT_FOUND)
        }
    }

    private fun getEntityForUpdate(workId: Long): SongAnalysisWorkEntity {
        return songAnalysisWorkRepository.findByIdForUpdate(workId)
            ?: throw BusinessException(ErrorCode.SONG_ANALYSIS_WORK_NOT_FOUND)
    }

    private fun SongAnalysisWorkEntity.isOwnedRunningBy(workerId: String, now: Instant): Boolean {
        return status == SongAnalysisWorkStatus.RUNNING &&
            lockedBy == workerId &&
            lockedUntil?.isAfter(now) == true
    }

    companion object {
        fun buildActiveDedupKey(title: String, artist: String): String {
            return "$title|$artist"
        }

        fun buildAdminReanalysisDedupKey(songId: Long): String {
            return "ADMIN_SONG_REANALYSIS|$songId"
        }
    }
}
