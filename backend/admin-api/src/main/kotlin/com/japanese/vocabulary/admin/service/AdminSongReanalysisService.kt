package com.japanese.vocabulary.admin.service

import com.japanese.vocabulary.admin.dto.AdminSongAnalysisWorkSummaryResponse
import com.japanese.vocabulary.admin.repository.AdminSongAnalysisWorkRepository
import com.japanese.vocabulary.admin.repository.AdminSongRepository
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class AdminSongReanalysisService(
    private val songRepository: AdminSongRepository,
    private val workRepository: AdminSongAnalysisWorkRepository,
) {
    @Transactional
    fun createOrReuse(songId: Long): AdminSongAnalysisWorkSummaryResponse {
        val song = songRepository.findById(songId).orElseThrow { NoSuchElementException("Song not found") }

        findActiveBlocker(songId, song.title, song.artist)?.let { return it.toSummaryResponse() }

        val work = SongAnalysisWorkEntity(
            rawTitle = song.title,
            rawArtist = song.artist,
            durationSeconds = song.durationSeconds,
            artworkUrl = song.artworkUrl,
            activeDedupKey = adminReanalysisDedupKey(songId),
            status = SongAnalysisWorkStatus.PENDING,
            songId = songId,
            triggerSource = SongAnalysisTriggerSource.ADMIN,
            createdByUserId = null,
        )

        return try {
            workRepository.saveAndFlush(work).toSummaryResponse()
        } catch (_: DataIntegrityViolationException) {
            findActiveBlocker(songId, song.title, song.artist)?.toSummaryResponse()
                ?: throw IllegalStateException("Admin song reanalysis work already exists but could not be loaded")
        }
    }

    private fun findActiveBlocker(songId: Long, title: String, artist: String): SongAnalysisWorkEntity? {
        val activeStatuses = listOf(SongAnalysisWorkStatus.PENDING, SongAnalysisWorkStatus.RUNNING)
        return workRepository.findFirstBySongIdAndStatusInOrderByCreatedAtAsc(songId, activeStatuses)
            ?: workRepository.findByActiveDedupKey(adminReanalysisDedupKey(songId))
            ?: workRepository.findByActiveDedupKey(SongAnalysisWorkService.buildActiveDedupKey(title, artist))
    }

    private fun adminReanalysisDedupKey(songId: Long): String = "ADMIN_SONG_REANALYSIS|$songId"
}
