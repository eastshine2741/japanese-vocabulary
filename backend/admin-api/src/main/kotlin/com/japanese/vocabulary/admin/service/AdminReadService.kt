package com.japanese.vocabulary.admin.service

import com.japanese.vocabulary.admin.dto.AdminLyricDetailResponse
import com.japanese.vocabulary.admin.dto.AdminLyricSummaryResponse
import com.japanese.vocabulary.admin.dto.AdminSongAnalysisWorkDetailResponse
import com.japanese.vocabulary.admin.dto.AdminSongAnalysisWorkSummaryResponse
import com.japanese.vocabulary.admin.dto.AdminSongDetailResponse
import com.japanese.vocabulary.admin.dto.AdminSongSummaryResponse
import com.japanese.vocabulary.admin.dto.AdminUserResponse
import com.japanese.vocabulary.admin.repository.AdminLyricRepository
import com.japanese.vocabulary.admin.repository.AdminSongRepository
import com.japanese.vocabulary.admin.repository.AdminSongAnalysisWorkRepository
import com.japanese.vocabulary.admin.repository.AdminUserRepository
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.user.entity.UserEntity
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional(readOnly = true)
class AdminReadService(
    private val songRepository: AdminSongRepository,
    private val lyricRepository: AdminLyricRepository,
    private val songAnalysisWorkRepository: AdminSongAnalysisWorkRepository,
    private val userRepository: AdminUserRepository,
) {
    fun listSongs(query: String?, pageable: Pageable): Page<AdminSongSummaryResponse> {
        val page = query?.trim()?.takeIf { it.isNotEmpty() }
            ?.let { songRepository.findByTitleContainingIgnoreCaseOrArtistContainingIgnoreCase(it, it, pageable) }
            ?: songRepository.findAll(pageable)
        return page.map { it.toSummaryResponse() }
    }

    fun getSong(id: Long): AdminSongDetailResponse {
        val song = songRepository.findById(id).orElseThrow { NoSuchElementException("Song not found") }
        val lyric = lyricRepository.findActiveBySongId(id)
        val activeStatuses = listOf(SongAnalysisWorkStatus.PENDING, SongAnalysisWorkStatus.RUNNING)
        val activeWork = songAnalysisWorkRepository.findFirstBySongIdAndStatusInOrderByCreatedAtAsc(id, activeStatuses)
        val analysisWorks = songAnalysisWorkRepository.findBySongIdOrderByCreatedAtDesc(id, PageRequest.of(0, 10))
        return song.toDetailResponse(lyric, activeWork, analysisWorks)
    }

    fun getSongLyric(songId: Long): AdminLyricDetailResponse {
        val lyric = lyricRepository.findActiveBySongId(songId) ?: throw NoSuchElementException("Lyric not found")
        return lyric.toDetailResponse()
    }

    fun listLyrics(pageable: Pageable): Page<AdminLyricSummaryResponse> {
        return lyricRepository.findAll(pageable).map { it.toSummaryResponse() }
    }

    fun getLyric(id: Long): AdminLyricDetailResponse {
        val lyric = lyricRepository.findById(id).orElseThrow { NoSuchElementException("Lyric not found") }
        return lyric.toDetailResponse()
    }

    fun listSongAnalysisWorks(
        status: SongAnalysisWorkStatus?,
        pageable: Pageable,
    ): Page<AdminSongAnalysisWorkSummaryResponse> {
        val page = status?.let { songAnalysisWorkRepository.findByStatus(it, pageable) }
            ?: songAnalysisWorkRepository.findAll(pageable)
        return page.map { it.toSummaryResponse() }
    }

    fun getSongAnalysisWork(id: Long): AdminSongAnalysisWorkDetailResponse {
        val work = songAnalysisWorkRepository.findById(id).orElseThrow {
            NoSuchElementException("Song analysis work not found")
        }
        return work.toDetailResponse()
    }

    fun listUsers(query: String?, pageable: Pageable): Page<AdminUserResponse> {
        val page = query?.trim()?.takeIf { it.isNotEmpty() }
            ?.let {
                userRepository.findByUsernameContainingIgnoreCaseOrEmailContainingIgnoreCaseOrNameContainingIgnoreCase(
                    it,
                    it,
                    it,
                    pageable,
                )
            }
            ?: userRepository.findAll(pageable)
        return page.map { it.toResponse() }
    }

    fun getUser(id: Long): AdminUserResponse {
        return userRepository.findById(id).orElseThrow { NoSuchElementException("User not found") }.toResponse()
    }
}

fun SongEntity.toSummaryResponse(): AdminSongSummaryResponse = AdminSongSummaryResponse(
    id = requireNotNull(id),
    title = title,
    artist = artist,
    durationSeconds = durationSeconds,
    youtubeUrl = youtubeUrl,
    artworkUrl = artworkUrl,
    createdAt = createdAt,
)

fun SongEntity.toDetailResponse(
    lyric: LyricEntity?,
    activeReanalysisWork: SongAnalysisWorkEntity?,
    analysisWorks: List<SongAnalysisWorkEntity>,
): AdminSongDetailResponse = AdminSongDetailResponse(
    id = requireNotNull(id),
    title = title,
    artist = artist,
    durationSeconds = durationSeconds,
    youtubeUrl = youtubeUrl,
    artworkUrl = artworkUrl,
    createdAt = createdAt,
    updatedAt = updatedAt,
    lyric = lyric?.toSummaryResponse(),
    activeReanalysisWork = activeReanalysisWork?.toSummaryResponse(),
    analysisWorks = analysisWorks.map { it.toSummaryResponse() },
)

fun LyricEntity.toSummaryResponse(): AdminLyricSummaryResponse = AdminLyricSummaryResponse(
    id = requireNotNull(id),
    songId = songId,
    lyricType = lyricType.name,
    lrclibId = lrclibId,
    vocadbId = vocadbId,
    createdAt = createdAt,
    updatedAt = updatedAt,
)

fun LyricEntity.toDetailResponse(): AdminLyricDetailResponse = AdminLyricDetailResponse(
    id = requireNotNull(id),
    songId = songId,
    lyricType = lyricType.name,
    rawContent = rawContent,
    analyzedContent = analyzedContent,
    lrclibId = lrclibId,
    vocadbId = vocadbId,
    createdAt = createdAt,
    updatedAt = updatedAt,
)

fun SongAnalysisWorkEntity.toSummaryResponse(): AdminSongAnalysisWorkSummaryResponse =
    AdminSongAnalysisWorkSummaryResponse(
        id = requireNotNull(id),
        rawTitle = rawTitle,
        rawArtist = rawArtist,
        status = status.name,
        currentStage = currentStage?.name,
        songId = songId,
        lyricId = lyricId,
        youtubeUrl = youtubeUrl,
        triggerSource = triggerSource.name,
        createdByUserId = createdByUserId,
        createdAt = createdAt,
        updatedAt = updatedAt,
        playerReadyAt = playerReadyAt,
        completedAt = completedAt,
        failedAt = failedAt,
    )

fun SongAnalysisWorkEntity.toDetailResponse(): AdminSongAnalysisWorkDetailResponse =
    AdminSongAnalysisWorkDetailResponse(
        id = requireNotNull(id),
        rawTitle = rawTitle,
        rawArtist = rawArtist,
        durationSeconds = durationSeconds,
        artworkUrl = artworkUrl,
        activeDedupKey = activeDedupKey,
        status = status.name,
        currentStage = currentStage?.name,
        songId = songId,
        lyricId = lyricId,
        youtubeUrl = youtubeUrl,
        lockedBy = lockedBy,
        lockedUntil = lockedUntil,
        errorCode = errorCode,
        errorMessage = errorMessage,
        triggerSource = triggerSource.name,
        createdByUserId = createdByUserId,
        createdAt = createdAt,
        updatedAt = updatedAt,
        playerReadyAt = playerReadyAt,
        completedAt = completedAt,
        failedAt = failedAt,
    )

fun UserEntity.toResponse(): AdminUserResponse = AdminUserResponse(
    id = requireNotNull(id),
    provider = provider,
    username = username,
    email = email,
    name = name,
    createdAt = createdAt,
    deletedAt = deletedAt,
)
