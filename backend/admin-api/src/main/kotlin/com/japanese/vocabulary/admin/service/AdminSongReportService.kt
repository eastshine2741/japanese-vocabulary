package com.japanese.vocabulary.admin.service

import com.japanese.vocabulary.admin.dto.AdminSongReportApproveRequest
import com.japanese.vocabulary.admin.dto.AdminSongReportContextResponse
import com.japanese.vocabulary.admin.dto.AdminSongReportDetailResponse
import com.japanese.vocabulary.admin.dto.AdminSongReportLineResponse
import com.japanese.vocabulary.admin.dto.AdminSongReportRejectRequest
import com.japanese.vocabulary.admin.dto.AdminSongReportSongResponse
import com.japanese.vocabulary.admin.dto.AdminSongReportSummaryResponse
import com.japanese.vocabulary.admin.repository.AdminLyricRepository
import com.japanese.vocabulary.admin.repository.AdminSongRepository
import com.japanese.vocabulary.admin.repository.AdminUserRepository
import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.entity.SongReportEntity
import com.japanese.vocabulary.song.entity.SongReportStatus
import com.japanese.vocabulary.song.repository.SongReportRepository
import com.japanese.vocabulary.song.service.SongReportService
import com.japanese.vocabulary.user.entity.UserEntity
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class AdminSongReportService(
    private val songReportRepository: SongReportRepository,
    private val songReportService: SongReportService,
    private val songRepository: AdminSongRepository,
    private val lyricRepository: AdminLyricRepository,
    private val userRepository: AdminUserRepository,
) {
    @Transactional(readOnly = true)
    fun list(status: SongReportStatus?, pageable: Pageable): Page<AdminSongReportSummaryResponse> {
        val sorted = PageRequest.of(pageable.pageNumber, pageable.pageSize, Sort.by(Sort.Direction.DESC, "id"))
        val page = status?.let { songReportRepository.findByStatus(it, sorted) } ?: songReportRepository.findAll(sorted)
        val songsById = songRepository.findAllById(page.content.map { it.songId }.toSet()).associateBy { it.id }
        val usersById = userRepository.findAllById(page.content.map { it.userId }.toSet()).associateBy { it.id }
        return page.map { it.toSummaryResponse(songsById[it.songId], usersById[it.userId]) }
    }

    @Transactional(readOnly = true)
    fun get(id: Long): AdminSongReportDetailResponse =
        detail(songReportRepository.findById(id).orElseThrow { BusinessException(ErrorCode.SONG_REPORT_NOT_FOUND) })

    @Transactional
    fun approve(id: Long, request: AdminSongReportApproveRequest): AdminSongReportDetailResponse =
        detail(songReportService.approve(id, request.changes, request.note))

    @Transactional
    fun reject(id: Long, request: AdminSongReportRejectRequest): AdminSongReportDetailResponse =
        detail(songReportService.reject(id, request.note))

    private fun detail(report: SongReportEntity): AdminSongReportDetailResponse {
        val song = songRepository.findById(report.songId).orElse(null)
        val user = userRepository.findById(report.userId).orElse(null)
        val lineIndex = report.reportTarget?.lineIndex
        val activeLyric = lineIndex?.let { lyricRepository.findActiveBySongId(report.songId) }
        val line = activeLyric?.rawContent?.firstOrNull { it.index == lineIndex }?.let { raw ->
            val analyzed = activeLyric.analyzedContent.orEmpty().firstOrNull { it.index == lineIndex }
            AdminSongReportLineResponse(
                index = raw.index,
                text = raw.text,
                koreanLyrics = analyzed?.koreanLyrics,
                tokens = analyzed?.tokens.orEmpty(),
            )
        }
        val summary = report.toSummaryResponse(song, user)
        return AdminSongReportDetailResponse(
            id = summary.id,
            songId = summary.songId,
            songTitle = summary.songTitle,
            songArtist = summary.songArtist,
            userId = summary.userId,
            username = summary.username,
            type = summary.type,
            typeLabel = summary.typeLabel,
            status = summary.status,
            createdAt = summary.createdAt,
            reviewedAt = summary.reviewedAt,
            target = report.reportTarget,
            suggestion = report.reportSuggestion,
            reviewChanges = report.reviewChanges,
            reviewNote = report.reviewNote,
            context = AdminSongReportContextResponse(
                song = song?.let { AdminSongReportSongResponse(it.id!!, it.title, it.artist, it.youtubeUrl) },
                reportLyricId = report.lyricId,
                activeLyricId = song?.activeLyricId,
                line = line,
            ),
        )
    }

    private fun SongReportEntity.toSummaryResponse(song: SongEntity?, user: UserEntity?) = AdminSongReportSummaryResponse(
        id = requireNotNull(id),
        songId = songId,
        songTitle = song?.title,
        songArtist = song?.artist,
        userId = userId,
        username = user?.username,
        type = type.name,
        typeLabel = type.label,
        status = status.name,
        createdAt = createdAt,
        reviewedAt = reviewedAt,
    )
}
