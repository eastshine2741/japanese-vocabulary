package com.japanese.vocabulary.notification.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.notification.dto.AnalysisNotificationResponse
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
import org.slf4j.LoggerFactory
import org.springframework.dao.DataAccessException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class AnalysisNotificationService(
    private val songRepository: SongRepository,
    private val workService: SongAnalysisWorkService,
    private val subscriptions: AnalysisNotificationSubscriptions,
) {
    private val logger = LoggerFactory.getLogger(javaClass)

    @Transactional
    fun update(userId: Long, songId: Long, enabled: Boolean): AnalysisNotificationResponse {
        val song = songRepository.findById(songId).orElseThrow { BusinessException(ErrorCode.SONG_NOT_FOUND) }
        val lyricId = song.activeLyricId ?: throw BusinessException(ErrorCode.SONG_ANALYSIS_NOT_PENDING)
        val work = workService.getLatestForLyricForUpdate(songId, lyricId)
            ?: throw BusinessException(ErrorCode.SONG_ANALYSIS_NOT_PENDING)

        if (enabled && work.status == SongAnalysisWorkStatus.COMPLETED) {
            return AnalysisNotificationResponse(songId, work.workId, false)
        }
        if (enabled && work.status !in setOf(SongAnalysisWorkStatus.PENDING, SongAnalysisWorkStatus.RUNNING)) {
            throw BusinessException(ErrorCode.SONG_ANALYSIS_NOT_PENDING)
        }

        // The work's completion transaction takes the same row lock. Keep it until Redis has
        // accepted the change so AFTER_COMMIT cannot consume before a successful registration.
        try {
            if (enabled) subscriptions.subscribe(work.workId, userId)
            else subscriptions.unsubscribe(work.workId, userId)
        } catch (e: DataAccessException) {
            logger.warn("Analysis notification subscription failed workId={} userId={}", work.workId, userId, e)
            throw BusinessException(ErrorCode.ANALYSIS_NOTIFICATION_UNAVAILABLE)
        }
        return AnalysisNotificationResponse(songId, work.workId, enabled)
    }
}
