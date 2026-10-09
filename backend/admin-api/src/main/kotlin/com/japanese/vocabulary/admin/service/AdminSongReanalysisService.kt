package com.japanese.vocabulary.admin.service

import com.japanese.vocabulary.admin.dto.AdminSongAnalysisWorkSummaryResponse
import com.japanese.vocabulary.admin.repository.AdminSongAnalysisWorkRepository
import com.japanese.vocabulary.admin.repository.AdminSongRepository
import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.songanalysis.event.SongAnalysisWorkQueuedEvent
import org.springframework.context.ApplicationEventPublisher
import org.springframework.dao.ConcurrencyFailureException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class AdminSongReanalysisService(
    private val songRepository: AdminSongRepository,
    private val workRepository: AdminSongAnalysisWorkRepository,
    private val eventPublisher: ApplicationEventPublisher,
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
            status = SongAnalysisWorkStatus.PENDING,
            songId = songId,
            triggerSource = SongAnalysisTriggerSource.ADMIN,
            createdByUserId = null,
        )

        val saved = try {
            workRepository.saveAndFlush(work)
        } catch (_: ConcurrencyFailureException) {
            // 같은 곡에 동시 요청이 겹치면 한쪽 insert 가 상대 갭 락에 걸려 트랜잭션째로 죽는다.
            // 죽은 트랜잭션에서는 상대가 만든 행을 읽을 수 없으므로 409 로 알린다.
            throw BusinessException(ErrorCode.SONG_ANALYSIS_WORK_ALREADY_EXISTS)
        }
        eventPublisher.publishEvent(SongAnalysisWorkQueuedEvent(saved.id!!))
        return saved.toSummaryResponse()
    }

    /**
     * 두 조회가 역할이 다르다. 앞은 "이 곡에 이미 붙은 작업" 을 찾고 (관리자가 곡 제목을 수정해
     * raw 문자열이 달라진 경우를 잡는다), 뒤는 유저 요청과 같은 갭 락을 잡아 동시 생성을 막는다.
     */
    private fun findActiveBlocker(songId: Long, title: String, artist: String): SongAnalysisWorkEntity? {
        val activeStatuses = listOf(SongAnalysisWorkStatus.PENDING, SongAnalysisWorkStatus.RUNNING)
        return workRepository.findFirstBySongIdAndStatusInOrderByCreatedAtAsc(songId, activeStatuses)
            ?: workRepository.findActiveByRawSongForUpdate(title, artist).firstOrNull()
    }
}
