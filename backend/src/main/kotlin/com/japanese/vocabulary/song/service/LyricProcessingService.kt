package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.song.client.LyricsNotFoundException
import com.japanese.vocabulary.song.client.lrclib.LrclibClient
import com.japanese.vocabulary.song.client.vocadb.VocadbClient
import com.japanese.vocabulary.song.client.youtube.YoutubeClient
import com.japanese.vocabulary.song.dto.*
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.parser.LrcParser
import com.japanese.vocabulary.song.entity.KoreanLyricStatus
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import org.springframework.stereotype.Service

@Service
class LyricProcessingService(
    private val lrclibClient: LrclibClient,
    private val vocadbClient: VocadbClient,
    private val lrcParser: LrcParser,
    private val songRepository: SongRepository,
    private val youtubeClient: YoutubeClient,
    private val recentSongService: RecentSongService,
    private val lyricRepository: LyricRepository
) {

    fun analyze(title: String, artist: String, durationSeconds: Int?, artworkUrl: String? = null, userId: Long? = null): SongDTO {
        // Check if already exists in DB
        songRepository.findByArtistAndTitle(artist, title)?.let {
            if (userId != null) {
                recentSongService.recordListen(userId, it.id!!)
            }
            return buildResponseFromEntity(it)
        }

        // Fetch lyrics from LRCLIB, fallback to VocaDB
        val lyricsResult = try {
            lrclibClient.getLyrics(title, artist, durationSeconds)
        } catch (e: LyricsNotFoundException) {
            vocadbClient.searchLyrics(title, artist)
                ?: throw e
        }

        // Parse lyrics
        val parsedLines = lrcParser.parse(lyricsResult.lyrics, lyricsResult.isSynced)
        val lyricType = if (lyricsResult.isSynced) LyricType.SYNCED else LyricType.PLAIN

        val lyricLineData = parsedLines.map { line ->
            LyricLineData(
                index = line.index,
                startTimeMs = line.startTimeMs,
                text = line.text
            )
        }

        // Fetch YouTube MV URL
        val youtubeUrl = try {
            youtubeClient.searchMvUrl(title, artist)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }

        // Save song (metadata only)
        val savedSong = songRepository.save(
            SongEntity(
                title = title,
                artist = artist,
                durationSeconds = durationSeconds,
                youtubeUrl = youtubeUrl,
                artworkUrl = artworkUrl
            )
        )

        // Create LyricEntity with rawContent and PENDING status
        lyricRepository.save(
            LyricEntity(
                songId = savedSong.id!!,
                lyricType = lyricType,
                rawContent = lyricLineData,
                status = KoreanLyricStatus.PENDING,
                lrclibId = lyricsResult.lrclibId,
                vocadbId = lyricsResult.vocadbId
            )
        )

        if (userId != null) {
            recentSongService.recordListen(userId, savedSong.id!!)
        }

        // Build response — batch not yet done, so tokens empty, no korean
        return SongDTO(
            song = SongInfo(
                id = savedSong.id!!,
                title = savedSong.title,
                artist = savedSong.artist,
                lyricType = lyricType.name
            ),
            studyUnits = lyricLineData.map { it.toStudyUnit() },
            youtubeUrl = savedSong.youtubeUrl
        )
    }

    fun buildSongDTO(entity: SongEntity): SongDTO = buildResponseFromEntity(entity)

    private fun buildResponseFromEntity(entity: SongEntity): SongDTO {
        val lyricEntity = lyricRepository.findBySongId(entity.id!!)

        if (lyricEntity == null) {
            return SongDTO(
                song = SongInfo(id = entity.id!!, title = entity.title, artist = entity.artist, lyricType = "PLAIN"),
                studyUnits = emptyList(),
                youtubeUrl = entity.youtubeUrl
            )
        }

        val lyricLines = lyricEntity.rawContent

        val studyUnits = if (lyricEntity.status == KoreanLyricStatus.COMPLETED && lyricEntity.analyzedContent != null) {
            val analyzedMap = lyricEntity.analyzedContent!!.associateBy { it.index }
            lyricLines.map { line ->
                val analyzed = analyzedMap[line.index]
                StudyUnit(
                    index = line.index,
                    originalText = line.text,
                    startTimeMs = line.startTimeMs,
                    tokens = analyzed?.tokens ?: emptyList(),
                    koreanLyrics = analyzed?.koreanLyrics,
                    koreanPronounciation = analyzed?.koreanPronounciation
                )
            }
        } else {
            lyricLines.map { it.toStudyUnit() }
        }

        return SongDTO(
            song = SongInfo(id = entity.id!!, title = entity.title, artist = entity.artist, lyricType = lyricEntity.lyricType.name),
            studyUnits = studyUnits,
            youtubeUrl = entity.youtubeUrl
        )
    }

    private fun LyricLineData.toStudyUnit() = StudyUnit(
        index = index,
        originalText = text,
        startTimeMs = startTimeMs,
        tokens = emptyList()
    )
}
