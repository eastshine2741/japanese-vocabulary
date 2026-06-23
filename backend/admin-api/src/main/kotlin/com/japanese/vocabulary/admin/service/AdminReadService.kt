package com.japanese.vocabulary.admin.service

import com.japanese.vocabulary.admin.dto.AdminLyricDetailResponse
import com.japanese.vocabulary.admin.dto.AdminLyricSummaryResponse
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
        val lyric = lyricRepository.findBySongId(id)
        val work = lyric?.id?.let { songAnalysisWorkRepository.findFirstByLyricIdOrderByCreatedAtDesc(it) }
        return song.toDetailResponse(lyric, work)
    }

    fun getSongLyric(songId: Long): AdminLyricDetailResponse {
        val lyric = lyricRepository.findBySongId(songId) ?: throw NoSuchElementException("Lyric not found")
        val work = lyric.id?.let { songAnalysisWorkRepository.findFirstByLyricIdOrderByCreatedAtDesc(it) }
        return lyric.toDetailResponse(work)
    }

    fun listLyrics(status: SongAnalysisWorkStatus?, pageable: Pageable): Page<AdminLyricSummaryResponse> {
        val page = status?.let { lyricRepository.findByAnalysisWorkStatus(it, pageable) }
            ?: lyricRepository.findAll(pageable)
        val worksByLyricId = latestWorksByLyricId(page.content)
        return page.map { it.toSummaryResponse(worksByLyricId[it.id]) }
    }

    fun getLyric(id: Long): AdminLyricDetailResponse {
        val lyric = lyricRepository.findById(id).orElseThrow { NoSuchElementException("Lyric not found") }
        val work = lyric.id?.let { songAnalysisWorkRepository.findFirstByLyricIdOrderByCreatedAtDesc(it) }
        return lyric.toDetailResponse(work)
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

    private fun latestWorksByLyricId(lyrics: List<LyricEntity>): Map<Long, SongAnalysisWorkEntity> {
        val lyricIds = lyrics.mapNotNull { it.id }
        if (lyricIds.isEmpty()) return emptyMap()
        return songAnalysisWorkRepository.findByLyricIdInOrderByCreatedAtDesc(lyricIds)
            .filter { it.lyricId != null }
            .distinctBy { it.lyricId }
            .associateBy { requireNotNull(it.lyricId) }
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
    work: SongAnalysisWorkEntity?,
): AdminSongDetailResponse = AdminSongDetailResponse(
    id = requireNotNull(id),
    title = title,
    artist = artist,
    durationSeconds = durationSeconds,
    youtubeUrl = youtubeUrl,
    artworkUrl = artworkUrl,
    createdAt = createdAt,
    lyric = lyric?.toSummaryResponse(work),
)

fun LyricEntity.toSummaryResponse(work: SongAnalysisWorkEntity?): AdminLyricSummaryResponse = AdminLyricSummaryResponse(
    id = requireNotNull(id),
    songId = songId,
    lyricType = lyricType.name,
    status = analysisStatus(work),
    retryCount = 0,
    lrclibId = lrclibId,
    vocadbId = vocadbId,
    createdAt = createdAt,
    updatedAt = updatedAt,
)

fun LyricEntity.toDetailResponse(work: SongAnalysisWorkEntity?): AdminLyricDetailResponse = AdminLyricDetailResponse(
    id = requireNotNull(id),
    songId = songId,
    lyricType = lyricType.name,
    rawContent = rawContent,
    analyzedContent = analyzedContent,
    status = analysisStatus(work),
    retryCount = 0,
    lrclibId = lrclibId,
    vocadbId = vocadbId,
    createdAt = createdAt,
    updatedAt = updatedAt,
)

private fun LyricEntity.analysisStatus(work: SongAnalysisWorkEntity?): String =
    work?.status?.name ?: if (analyzedContent != null) {
        SongAnalysisWorkStatus.COMPLETED.name
    } else {
        SongAnalysisWorkStatus.PENDING.name
    }

fun UserEntity.toResponse(): AdminUserResponse = AdminUserResponse(
    id = requireNotNull(id),
    provider = provider,
    username = username,
    email = email,
    name = name,
    createdAt = createdAt,
    deletedAt = deletedAt,
)
