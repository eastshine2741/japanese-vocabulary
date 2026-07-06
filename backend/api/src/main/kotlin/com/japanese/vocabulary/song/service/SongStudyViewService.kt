package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.song.dto.AnalyzedSongDto
import com.japanese.vocabulary.song.dto.SongInfoDto
import com.japanese.vocabulary.song.dto.StudyUnitDto
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.repository.LyricRepository
import org.springframework.stereotype.Service

@Service
class SongStudyViewService(
    private val lyricRepository: LyricRepository,
) {
    private data class LyricsSource(val name: String?, val url: String?)

    fun buildAnalyzedSong(entity: SongEntity): AnalyzedSongDto {
        val songId = entity.id!!
        val lyricEntity = lyricRepository.findActiveBySongId(songId)

        if (lyricEntity == null) {
            return AnalyzedSongDto(
                song = SongInfoDto(id = songId, title = entity.title, artist = entity.artist, lyricType = "PLAIN", artworkUrl = entity.artworkUrl),
                studyUnits = emptyList(),
                youtubeUrl = entity.youtubeUrl,
                lyricsSourceName = null,
                lyricsSourceUrl = null,
            )
        }

        val lyricLines = lyricEntity.rawContent
        val studyUnits = if (lyricEntity.analyzedContent != null) {
            val analyzedMap = lyricEntity.analyzedContent!!.associateBy { it.index }
            lyricLines.map { line ->
                val analyzed = analyzedMap[line.index]
                StudyUnitDto(
                    index = line.index,
                    originalText = line.text,
                    startTimeMs = line.startTimeMs,
                    tokens = analyzed?.tokens ?: emptyList(),
                    koreanLyrics = analyzed?.koreanLyrics,
                    koreanPronounciation = analyzed?.koreanPronounciation,
                )
            }
        } else {
            lyricLines.map { it.toStudyUnit() }
        }

        val source = resolveLyricsSource(lyricEntity.vocadbId, lyricEntity.lrclibId)
        return AnalyzedSongDto(
            song = SongInfoDto(id = songId, title = entity.title, artist = entity.artist, lyricType = lyricEntity.lyricType.name, artworkUrl = entity.artworkUrl),
            studyUnits = studyUnits,
            youtubeUrl = entity.youtubeUrl,
            lyricsSourceName = source.name,
            lyricsSourceUrl = source.url,
        )
    }

    private fun resolveLyricsSource(vocadbId: Long?, lrclibId: Long?): LyricsSource = when {
        vocadbId != null -> LyricsSource("VocaDB", "https://vocadb.net/S/$vocadbId")
        lrclibId != null -> LyricsSource("LRCLIB", "https://lrclib.net")
        else -> LyricsSource(null, null)
    }

    private fun LyricLineData.toStudyUnit() = StudyUnitDto(
        index = index,
        originalText = text,
        startTimeMs = startTimeMs,
        tokens = emptyList(),
    )
}
