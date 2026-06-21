package com.japanese.vocabulary.admin.service

import com.japanese.vocabulary.admin.dto.AdminLyricDetailResponse
import com.japanese.vocabulary.admin.dto.AdminLyricSummaryResponse
import com.japanese.vocabulary.admin.dto.AdminSongDetailResponse
import com.japanese.vocabulary.admin.dto.AdminSongSummaryResponse
import com.japanese.vocabulary.admin.dto.AdminUserResponse
import com.japanese.vocabulary.admin.repository.AdminLyricRepository
import com.japanese.vocabulary.admin.repository.AdminSongRepository
import com.japanese.vocabulary.admin.repository.AdminUserRepository
import com.japanese.vocabulary.song.entity.KoreanLyricStatus
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.SongEntity
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
        return song.toDetailResponse(lyric)
    }

    fun getSongLyric(songId: Long): AdminLyricDetailResponse {
        return lyricRepository.findBySongId(songId)?.toDetailResponse()
            ?: throw NoSuchElementException("Lyric not found")
    }

    fun listLyrics(status: KoreanLyricStatus?, pageable: Pageable): Page<AdminLyricSummaryResponse> {
        val page = status?.let { lyricRepository.findByStatus(it, pageable) }
            ?: lyricRepository.findAll(pageable)
        return page.map { it.toSummaryResponse() }
    }

    fun getLyric(id: Long): AdminLyricDetailResponse {
        return lyricRepository.findById(id).orElseThrow { NoSuchElementException("Lyric not found") }.toDetailResponse()
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

fun SongEntity.toDetailResponse(lyric: LyricEntity?): AdminSongDetailResponse = AdminSongDetailResponse(
    id = requireNotNull(id),
    title = title,
    artist = artist,
    durationSeconds = durationSeconds,
    youtubeUrl = youtubeUrl,
    artworkUrl = artworkUrl,
    createdAt = createdAt,
    lyric = lyric?.toSummaryResponse(),
)

fun LyricEntity.toSummaryResponse(): AdminLyricSummaryResponse = AdminLyricSummaryResponse(
    id = requireNotNull(id),
    songId = songId,
    lyricType = lyricType.name,
    status = status.name,
    retryCount = retryCount,
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
    status = status.name,
    retryCount = retryCount,
    lrclibId = lrclibId,
    vocadbId = vocadbId,
    createdAt = createdAt,
    updatedAt = updatedAt,
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
