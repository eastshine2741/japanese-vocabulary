package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.lyricsearch.LyricMatchConfidence
import com.japanese.vocabulary.lyricsearch.LyricProvider
import com.japanese.vocabulary.lyricsearch.LyricsResult
import com.japanese.vocabulary.lyricsearch.SongQueryNormalizer
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.parser.LrcParser
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service

@Service
class SongAnalysisPreparationService(
    private val lyricProviders: List<LyricProvider>,
    private val lrcParser: LrcParser,
    private val songRepository: SongRepository,
    private val youtubeMvSearchService: YoutubeMvSearchService,
    private val lyricRepository: LyricRepository
) {

    private val logger = LoggerFactory.getLogger(SongAnalysisPreparationService::class.java)

    data class PreparedLyric(
        val lyricType: LyricType,
        val lines: List<LyricLineData>,
        val lrclibId: Long?,
        val vocadbId: Long?,
    )

    data class SongLyricCreationResult(
        val song: SongEntity,
        val lyric: LyricEntity,
    )

    fun prepareLyrics(title: String, artist: String, durationSeconds: Int?): PreparedLyric {
        val lyricsResult = searchLyrics(title, artist, durationSeconds)
        val parsedLines = lrcParser.parse(lyricsResult.lyrics, lyricsResult.isSynced)
        val lyricType = if (lyricsResult.isSynced) LyricType.SYNCED else LyricType.PLAIN
        val lyricLineData = parsedLines.map { line ->
            LyricLineData(
                index = line.index,
                startTimeMs = line.startTimeMs,
                text = line.text
            )
        }
        return PreparedLyric(
            lyricType = lyricType,
            lines = lyricLineData,
            lrclibId = lyricsResult.lrclibId,
            vocadbId = lyricsResult.vocadbId,
        )
    }

    fun searchYoutubeUrl(title: String, artist: String, durationSeconds: Int?): String? {
        return try {
            youtubeMvSearchService.searchMvUrl(title, artist, durationSeconds)
        } catch (e: Exception) {
            logger.warn("YouTube MV search failed for '{}' by '{}': {}", title, artist, e.message)
            null
        }
    }

    fun saveSongAndLyric(
        title: String,
        artist: String,
        durationSeconds: Int?,
        artworkUrl: String?,
        youtubeUrl: String?,
        preparedLyric: PreparedLyric,
    ): SongLyricCreationResult {
        val existingSong = songRepository.findByArtistAndTitle(artist, title)
        if (existingSong != null) {
            val songId = existingSong.id!!
            lyricRepository.findActiveBySongId(songId)?.let { existingLyric ->
                return SongLyricCreationResult(existingSong, existingLyric)
            }
            val lyric = lyricRepository.save(
                LyricEntity(
                    songId = songId,
                    lyricType = preparedLyric.lyricType,
                    rawContent = preparedLyric.lines,
                    lrclibId = preparedLyric.lrclibId,
                    vocadbId = preparedLyric.vocadbId,
                )
            )
            existingSong.activeLyricId = lyric.id
            if (existingSong.youtubeUrl == null) existingSong.youtubeUrl = youtubeUrl
            songRepository.save(existingSong)
            return SongLyricCreationResult(existingSong, lyric)
        }

        val savedSong = songRepository.save(
            SongEntity(
                title = title,
                artist = artist,
                durationSeconds = durationSeconds,
                youtubeUrl = youtubeUrl,
                artworkUrl = artworkUrl
            )
        )
        val lyric = lyricRepository.save(
                LyricEntity(
                    songId = savedSong.id!!,
                    lyricType = preparedLyric.lyricType,
                    rawContent = preparedLyric.lines,
                    lrclibId = preparedLyric.lrclibId,
                    vocadbId = preparedLyric.vocadbId
                )
        )
        savedSong.activeLyricId = lyric.id
        songRepository.save(savedSong)
        return SongLyricCreationResult(savedSong, lyric)
    }

    fun createReplacementLyricForSong(songId: Long, preparedLyric: PreparedLyric): SongLyricCreationResult {
        val song = songRepository.findById(songId).orElseThrow {
            BusinessException(ErrorCode.SONG_NOT_FOUND)
        }
        val lyric = lyricRepository.save(
            LyricEntity(
                songId = songId,
                lyricType = preparedLyric.lyricType,
                rawContent = preparedLyric.lines,
                lrclibId = preparedLyric.lrclibId,
                vocadbId = preparedLyric.vocadbId,
            )
        )
        return SongLyricCreationResult(song, lyric)
    }

    /**
     * First STRONG hit wins. A WEAK hit (duration coincidence, no artist evidence) is held back
     * while the remaining providers get their turn, and used only when none of them can name the
     * artist — a same-titled song from another artist is the likelier reading of a weak hit.
     */
    private fun searchLyrics(title: String, artist: String, durationSeconds: Int?): LyricsResult {
        val query = SongQueryNormalizer.normalize(title, artist, durationSeconds)
        logger.info(
            "Lyric search started: '{}' by '{}' (normalized title: '{}', artist parts: {})",
            title, artist, query.normalizedTitle, query.artistParts
        )

        var weakFallback: Pair<LyricProvider, LyricsResult>? = null
        for (provider in lyricProviders) {
            logger.info("Trying provider: {}", provider.providerName)
            val result = provider.search(query)
            if (result == null) {
                logger.info("Provider {}: no results", provider.providerName)
                continue
            }
            if (result.confidence == LyricMatchConfidence.STRONG) {
                logFound(provider, result)
                return result
            }
            logger.info(
                "Provider {}: weak match only (lrclibId={}, vocadbId={}), trying remaining providers",
                provider.providerName, result.lrclibId, result.vocadbId
            )
            if (weakFallback == null) weakFallback = provider to result
        }

        if (weakFallback != null) {
            val (provider, result) = weakFallback
            logger.warn("No provider matched the artist for '{}' by '{}'; using weak match", title, artist)
            logFound(provider, result)
            return result
        }

        logger.warn("All lyric providers exhausted for: '{}' by '{}'", title, artist)
        throw BusinessException(ErrorCode.LYRICS_NOT_FOUND)
    }

    private fun logFound(provider: LyricProvider, result: LyricsResult) {
        logger.info(
            "Lyrics found via {} (confidence={}, synced={}, lrclibId={}, vocadbId={})",
            provider.providerName, result.confidence, result.isSynced, result.lrclibId, result.vocadbId
        )
    }
}
