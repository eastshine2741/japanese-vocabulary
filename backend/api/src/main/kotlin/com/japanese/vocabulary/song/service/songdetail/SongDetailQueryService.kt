package com.japanese.vocabulary.song.service.songdetail

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.song.dto.SongDto
import com.japanese.vocabulary.song.dto.songdetail.SongLyricLineDto
import com.japanese.vocabulary.song.dto.songdetail.SongLyricsDto
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.song.service.LyricMvSyncService
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class SongDetailQueryService(
    private val songRepository: SongRepository,
    private val lyricRepository: LyricRepository,
    private val lyricMvSyncService: LyricMvSyncService,
) {
    @Transactional(readOnly = true)
    fun metadata(songId: Long): SongDto {
        val song = songRepository.findById(songId).orElseThrow { BusinessException(ErrorCode.SONG_NOT_FOUND) }
        val lyric = lyricRepository.findActiveBySongId(songId)
        // MV 에 맞춘 시각이 있으면 PLAIN 가사도 앱에서 자동 싱크가 켜진다.
        val lyricType = when {
            lyric == null -> LyricType.PLAIN
            lyricMvSyncService.timingsFor(song, lyric) != null -> LyricType.SYNCED
            else -> lyric.lyricType
        }
        return SongDto(
            id = song.id!!,
            title = song.title,
            artist = song.artist,
            durationSeconds = song.durationSeconds,
            artworkUrl = song.artworkUrl,
            youtubeUrl = song.youtubeUrl,
            lyricType = lyricType,
            artistId = song.artistId,
            mvUnavailableReason = song.mvUnavailableReason,
        )
    }

    @Transactional(readOnly = true)
    fun lyrics(songId: Long): SongLyricsDto {
        val song = songRepository.findById(songId).orElseThrow { BusinessException(ErrorCode.SONG_NOT_FOUND) }
        val lyric = lyricRepository.findActiveBySongId(songId) ?: throw BusinessException(ErrorCode.LYRIC_NOT_FOUND)
        val source = lyric.source()
        val mvTimings = lyricMvSyncService.timingsFor(song, lyric)
        return SongLyricsDto(
            lyricId = lyric.id!!,
            lyricsSourceName = source.name,
            lyricsSourceUrl = source.url,
            mvSynced = mvTimings != null,
            lines = lyricLines(lyric, mvTimings),
        )
    }

    /** [mvTimings] 는 곡의 지금 MV 에 맞춘 줄 시각이다. 없으면 가사 원래 시각을 쓴다. */
    fun lyricLines(lyric: LyricEntity, mvTimings: Map<Int, Long?>? = null): List<SongLyricLineDto> {
        val analyzedByIndex = lyric.analyzedContent.orEmpty().associateBy { it.index }
        return lyric.rawContent.sortedBy { it.index }.map { raw ->
            val analyzed = analyzedByIndex[raw.index]
            SongLyricLineDto(
                index = raw.index,
                originalText = raw.text,
                startTimeMs = if (mvTimings != null) mvTimings[raw.index] else raw.startTimeMs,
                koreanLyrics = analyzed?.koreanLyrics,
                tokens = analyzed?.tokens ?: emptyList(),
            )
        }
    }

    private data class LyricsSource(val name: String?, val url: String?)
    private fun LyricEntity.source() = when {
        vocadbId != null -> LyricsSource("VocaDB", "https://vocadb.net/S/$vocadbId")
        utaitedbId != null -> LyricsSource("UtaiteDB", "https://utaitedb.net/S/$utaitedbId")
        lrclibId != null -> LyricsSource("LRCLIB", "https://lrclib.net")
        else -> LyricsSource(null, null)
    }
}
