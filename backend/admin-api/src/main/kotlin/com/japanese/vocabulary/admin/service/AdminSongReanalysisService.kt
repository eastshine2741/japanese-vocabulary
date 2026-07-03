package com.japanese.vocabulary.admin.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.songanalysis.dto.SongAnalysisWorkDto
import com.japanese.vocabulary.songanalysis.dto.toDto
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.songanalysis.repository.SongAnalysisWorkRepository
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class AdminSongReanalysisService(
    private val songRepository: SongRepository,
    private val workRepository: SongAnalysisWorkRepository,
) {
    @Transactional
    fun createOrReuse(songId: Long): SongAnalysisWorkDto {
        val song = songRepository.findByIdForUpdate(songId)
            ?: throw BusinessException(ErrorCode.SONG_NOT_FOUND)

        findActiveBlocker(songId)?.let { return it.toDto() }

        val rawDedupKey = SongAnalysisWorkService.buildActiveDedupKey(song.title, song.artist)
        workRepository.findByActiveDedupKey(rawDedupKey)?.let { return it.toDto() }

        val adminDedupKey = SongAnalysisWorkService.buildAdminReanalysisDedupKey(songId)
        val work = SongAnalysisWorkEntity(
            rawTitle = song.title,
            rawArtist = song.artist,
            durationSeconds = song.durationSeconds,
            artworkUrl = song.artworkUrl,
            activeDedupKey = adminDedupKey,
            songId = songId,
            triggerSource = SongAnalysisTriggerSource.ADMIN,
        )

        return try {
            workRepository.saveAndFlush(work).toDto()
        } catch (_: DataIntegrityViolationException) {
            findActiveBlocker(songId)?.toDto()
                ?: workRepository.findByActiveDedupKey(adminDedupKey)?.toDto()
                ?: throw BusinessException(ErrorCode.SONG_ANALYSIS_WORK_ALREADY_EXISTS)
        }
    }

    private fun findActiveBlocker(songId: Long): SongAnalysisWorkEntity? {
        return workRepository.findBySongIdAndStatusInOrderByCreatedAtAsc(
            songId,
            listOf(SongAnalysisWorkStatus.PENDING, SongAnalysisWorkStatus.RUNNING),
        ).firstOrNull()
    }
}
