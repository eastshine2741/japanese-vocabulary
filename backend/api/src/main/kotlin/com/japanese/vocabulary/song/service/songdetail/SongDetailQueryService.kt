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
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class SongDetailQueryService(
    private val songRepository: SongRepository,
    private val lyricRepository: LyricRepository,
) {
    @Transactional(readOnly = true)
    fun metadata(songId: Long): SongDto {
        val song = songRepository.findById(songId).orElseThrow { BusinessException(ErrorCode.SONG_NOT_FOUND) }
        val lyric = lyricRepository.findActiveBySongId(songId)
        return SongDto(
            id = song.id!!,
            title = song.title,
            artist = song.artist,
            durationSeconds = song.durationSeconds,
            artworkUrl = song.artworkUrl,
            youtubeUrl = song.youtubeUrl,
            lyricType = lyric?.lyricType ?: LyricType.PLAIN,
            artistId = song.artistId,
        )
    }

    @Transactional(readOnly = true)
    fun lyrics(songId: Long): SongLyricsDto {
        songRepository.findById(songId).orElseThrow { BusinessException(ErrorCode.SONG_NOT_FOUND) }
        val lyric = lyricRepository.findActiveBySongId(songId) ?: throw BusinessException(ErrorCode.LYRIC_NOT_FOUND)
        val source = lyric.source()
        return SongLyricsDto(
            lyricId = lyric.id!!,
            lyricsSourceName = source.name,
            lyricsSourceUrl = source.url,
            lines = lyricLines(lyric),
        )
    }

    fun lyricLines(lyric: LyricEntity): List<SongLyricLineDto> {
        val analyzedByIndex = lyric.analyzedContent.orEmpty().associateBy { it.index }
        return lyric.rawContent.sortedBy { it.index }.map { raw ->
            val analyzed = analyzedByIndex[raw.index]
            SongLyricLineDto(
                index = raw.index,
                originalText = raw.text,
                startTimeMs = raw.startTimeMs,
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
