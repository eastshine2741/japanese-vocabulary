package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.song.client.LyricProvider
import com.japanese.vocabulary.song.client.SongQueryNormalizer
import com.japanese.vocabulary.song.client.LyricsResult
import com.japanese.vocabulary.song.model.*
import com.japanese.vocabulary.song.dto.*
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.parser.LrcParser
import com.japanese.vocabulary.song.entity.KoreanLyricStatus
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service

@Service
class LyricProcessingService(
    private val lyricProviders: List<LyricProvider>,
    private val lrcParser: LrcParser,
    private val songRepository: SongRepository,
    private val youtubeMvSearchService: YoutubeMvSearchService,
    private val recentSongService: RecentSongService,
    private val lyricRepository: LyricRepository
) {

    private val logger = LoggerFactory.getLogger(LyricProcessingService::class.java)

    private data class LyricsSource(val name: String?, val url: String?)

    private fun resolveLyricsSource(vocadbId: Long?, lrclibId: Long?): LyricsSource = when {
        vocadbId != null -> LyricsSource("VocaDB", "https://vocadb.net/S/$vocadbId")
        lrclibId != null -> LyricsSource("LRCLIB", "https://lrclib.net")
        else -> LyricsSource(null, null)
    }

    fun analyze(title: String, artist: String, durationSeconds: Int?, artworkUrl: String? = null, userId: Long? = null): AnalyzedSongDto {
        // Check if already exists in DB
        songRepository.findByArtistAndTitle(artist, title)?.let {
            if (userId != null) {
                recentSongService.recordListen(userId, it.id!!)
            }
            return buildResponseFromEntity(it)
        }

        // Fetch lyrics from providers
        val lyricsResult = searchLyrics(title, artist, durationSeconds)

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
            youtubeMvSearchService.searchMvUrl(title, artist)
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
        val source = resolveLyricsSource(lyricsResult.vocadbId, lyricsResult.lrclibId)
        return AnalyzedSongDto(
            song = SongInfoDto(
                id = savedSong.id!!,
                title = savedSong.title,
                artist = savedSong.artist,
                lyricType = lyricType.name,
                artworkUrl = savedSong.artworkUrl,
            ),
            studyUnits = lyricLineData.map { it.toStudyUnit() },
            youtubeUrl = savedSong.youtubeUrl,
            lyricsSourceName = source.name,
            lyricsSourceUrl = source.url
        )
    }

    private fun searchLyrics(title: String, artist: String, durationSeconds: Int?): LyricsResult {
        val query = SongQueryNormalizer.normalize(title, artist, durationSeconds)
        logger.info(
            "Lyric search started: '{}' by '{}' (normalized title: '{}', artist parts: {})",
            title, artist, query.normalizedTitle, query.artistParts
        )

        for (provider in lyricProviders) {
            logger.info("Trying provider: {}", provider.providerName)
            val result = provider.search(query)
            if (result != null) {
                logger.info(
                    "Lyrics found via {} (synced={}, lrclibId={}, vocadbId={})",
                    provider.providerName, result.isSynced, result.lrclibId, result.vocadbId
                )
                return result
            }
            logger.info("Provider {}: no results", provider.providerName)
        }

        logger.warn("All lyric providers exhausted for: '{}' by '{}'", title, artist)
        throw BusinessException(ErrorCode.LYRICS_NOT_FOUND)
    }

    fun buildAnalyzedSong(entity: SongEntity): AnalyzedSongDto = buildResponseFromEntity(entity)

    private fun buildResponseFromEntity(entity: SongEntity): AnalyzedSongDto {
        val lyricEntity = lyricRepository.findBySongId(entity.id!!)

        if (lyricEntity == null) {
            return AnalyzedSongDto(
                song = SongInfoDto(id = entity.id!!, title = entity.title, artist = entity.artist, lyricType = "PLAIN", artworkUrl = entity.artworkUrl),
                studyUnits = emptyList(),
                youtubeUrl = entity.youtubeUrl,
                lyricsSourceName = null,
                lyricsSourceUrl = null
            )
        }

        val lyricLines = lyricEntity.rawContent

        val studyUnits = if (lyricEntity.status == KoreanLyricStatus.COMPLETED && lyricEntity.analyzedContent != null) {
            val analyzedMap = lyricEntity.analyzedContent!!.associateBy { it.index }
            lyricLines.map { line ->
                val analyzed = analyzedMap[line.index]
                StudyUnitDto(
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

        val source = resolveLyricsSource(lyricEntity.vocadbId, lyricEntity.lrclibId)
        return AnalyzedSongDto(
            song = SongInfoDto(id = entity.id!!, title = entity.title, artist = entity.artist, lyricType = lyricEntity.lyricType.name, artworkUrl = entity.artworkUrl),
            studyUnits = studyUnits,
            youtubeUrl = entity.youtubeUrl,
            lyricsSourceName = source.name,
            lyricsSourceUrl = source.url
        )
    }

    private fun LyricLineData.toStudyUnit() = StudyUnitDto(
        index = index,
        originalText = text,
        startTimeMs = startTimeMs,
        tokens = emptyList()
    )
}
