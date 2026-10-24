package com.japanese.vocabulary.admin.service

import com.japanese.vocabulary.admin.dto.AdminLyricMvSyncDetailResponse
import com.japanese.vocabulary.admin.dto.AdminLyricMvSyncLineResponse
import com.japanese.vocabulary.admin.dto.AdminLyricMvSyncSummaryResponse
import com.japanese.vocabulary.admin.repository.AdminLyricMvSyncRepository
import com.japanese.vocabulary.admin.repository.AdminLyricRepository
import com.japanese.vocabulary.admin.repository.AdminSongRepository
import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricMvSyncEntity
import com.japanese.vocabulary.song.entity.LyricMvSyncStatus
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.model.YoutubeVideoId
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional(readOnly = true)
class AdminLyricMvSyncReadService(
    private val syncRepository: AdminLyricMvSyncRepository,
    private val lyricRepository: AdminLyricRepository,
    private val songRepository: AdminSongRepository,
) {
    fun list(status: LyricMvSyncStatus?, verdict: String?, pageable: Pageable): Page<AdminLyricMvSyncSummaryResponse> {
        // 정렬은 쿼리에 박혀 있어 요청의 sort 는 버린다.
        val page = syncRepository.search(status?.name, verdict?.takeIf { it.isNotBlank() }, PageRequest.of(pageable.pageNumber, pageable.pageSize))
        val lyrics = lyricRepository.findAllById(page.content.map { it.lyricId }.toSet()).associateBy { it.id!! }
        val songs = songRepository.findAllById(lyrics.values.map { it.songId }.toSet()).associateBy { it.id!! }
        return page.map { sync ->
            val lyric = lyrics[sync.lyricId]
            sync.toSummary(lyric, lyric?.let { songs[it.songId] })
        }
    }

    fun get(id: Long): AdminLyricMvSyncDetailResponse {
        val sync = syncRepository.findById(id).orElseThrow { BusinessException(ErrorCode.LYRIC_MV_SYNC_NOT_FOUND) }
        val lyric = lyricRepository.findById(sync.lyricId).orElseThrow { BusinessException(ErrorCode.LYRIC_NOT_FOUND) }
        val song = songRepository.findById(lyric.songId).orElse(null)
        val synced = sync.lineTimings.orEmpty().associate { it.index to it.startTimeMs }
        return AdminLyricMvSyncDetailResponse(
            summary = sync.toSummary(lyric, song),
            confidence = sync.confidence,
            lines = lyric.rawContent.sortedBy { it.index }.map {
                AdminLyricMvSyncLineResponse(
                    index = it.index,
                    text = it.text,
                    originalStartTimeMs = it.startTimeMs,
                    syncedStartTimeMs = synced[it.index],
                )
            },
        )
    }
}

private fun LyricMvSyncEntity.toSummary(lyric: LyricEntity?, song: SongEntity?) = AdminLyricMvSyncSummaryResponse(
    id = id!!,
    songId = song?.id,
    title = song?.title,
    artist = song?.artist,
    lyricId = lyricId,
    lyricType = lyric?.lyricType?.name,
    youtubeVideoId = youtubeVideoId,
    status = status.name,
    method = method?.name,
    attempt = attempt,
    verdict = confidence?.get("verdict") as? String,
    lineCount = (confidence?.get("lines") as? Number)?.toInt(),
    anchoredCount = (confidence?.get("anchored") as? Number)?.toInt(),
    errorMessage = errorMessage,
    completedAt = completedAt,
    inUse = song != null && song.activeLyricId == lyricId && YoutubeVideoId.parse(song.youtubeUrl) == youtubeVideoId,
)
