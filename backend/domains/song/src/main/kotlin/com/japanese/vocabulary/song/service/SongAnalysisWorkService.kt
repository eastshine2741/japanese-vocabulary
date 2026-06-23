package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.song.dto.SongAnalysisWorkDto
import com.japanese.vocabulary.song.dto.toDto
import com.japanese.vocabulary.song.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.song.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.song.entity.SongAnalysisWorkStage
import com.japanese.vocabulary.song.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongAnalysisWorkRepository
import com.japanese.vocabulary.song.repository.SongRepository
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

@Service
class SongAnalysisWorkService(
    private val songAnalysisWorkRepository: SongAnalysisWorkRepository,
    private val songRepository: SongRepository,
    private val lyricRepository: LyricRepository,
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

        val now = Instant.now()
        val existingSong = songRepository.findByArtistAndTitle(artist, title)
        val existingLyric = existingSong?.id?.let { lyricRepository.findBySongId(it) }

        val work = SongAnalysisWorkEntity(
            rawTitle = title,
            rawArtist = artist,
            durationSeconds = durationSeconds,
            artworkUrl = artworkUrl,
            activeDedupKey = activeDedupKey,
            triggerSource = triggerSource,
            createdByUserId = createdByUserId,
        )

        if (existingSong != null && existingLyric != null) {
            work.attachPlayerReady(existingSong.id, existingLyric.id!!, now)
            work.currentStage = SongAnalysisWorkStage.ANALYZE_LYRICS
            if (existingLyric.analyzedContent != null) {
                work.markCompleted(now)
            }
        }

        return try {
            songAnalysisWorkRepository.saveAndFlush(work).toDto()
        } catch (_: DataIntegrityViolationException) {
            throw BusinessException(ErrorCode.SONG_ANALYSIS_WORK_ALREADY_EXISTS)
        }
    }

    @Transactional(readOnly = true)
    fun getById(id: Long): SongAnalysisWorkDto {
        return songAnalysisWorkRepository.findById(id).orElse(null)?.toDto()
            ?: throw BusinessException(ErrorCode.SONG_ANALYSIS_WORK_NOT_FOUND)
    }

    @Transactional
    fun claimPending(limit: Int, workerId: String, lockUntil: Instant): List<SongAnalysisWorkEntity> {
        val works = songAnalysisWorkRepository.findClaimableForUpdate(
            org.springframework.data.domain.Pageable.ofSize(limit),
        )
        works.forEach { work ->
            work.status = SongAnalysisWorkStatus.RUNNING
            work.lockedBy = workerId
            work.lockedUntil = lockUntil
            work.currentStage = null
            work.clearFailure()
        }
        return songAnalysisWorkRepository.saveAllAndFlush(works)
    }

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
        if (!work.isOwnedRunningBy(workerId, Instant.now())) return false
        work.currentStage = stage
        return true
    }

    @Transactional
    fun markPlayerReady(workId: Long, workerId: String, songId: Long, lyricId: Long): Boolean {
        val work = getEntityForUpdate(workId)
        if (!work.isOwnedRunningBy(workerId, Instant.now())) return false
        work.attachPlayerReady(songId, lyricId, Instant.now())
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
    fun completeWithAnalyzedContent(
        workId: Long,
        workerId: String,
        lyricId: Long,
        analyzedLines: List<AnalyzedLine>,
    ): Boolean {
        val now = Instant.now()
        val work = getEntityForUpdate(workId)
        if (!work.isOwnedRunningBy(workerId, now)) return false

        val lyric = lyricRepository.findById(lyricId).orElseThrow {
            BusinessException(ErrorCode.LYRIC_NOT_FOUND)
        }
        lyric.analyzedContent = analyzedLines
        lyricRepository.save(lyric)

        work.markCompleted(now)
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
    }
}
