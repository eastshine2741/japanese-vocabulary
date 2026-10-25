package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.common.retry.ExponentialBackoff
import com.japanese.vocabulary.common.retry.TransientHttpErrors
import com.japanese.vocabulary.common.retry.currentRetryDeadline
import com.japanese.vocabulary.lyricsearch.LanguageVersion
import com.japanese.vocabulary.lyricsearch.LyricProvider
import com.japanese.vocabulary.lyricsearch.LyricsResult
import com.japanese.vocabulary.lyricsearch.SongQueryNormalizer
import com.japanese.vocabulary.song.entity.LyricType
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.parser.LrcParser
import com.japanese.vocabulary.song.parser.ParsedLyricLine
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.time.Duration

@Service
class SongAnalysisPreparationService(
    private val lyricProviders: List<LyricProvider>,
    private val lrcParser: LrcParser,
    private val songRepository: SongRepository,
    private val youtubeMvSearchService: YoutubeMvSearchService,
    private val artistYoutubeChannelService: ArtistYoutubeChannelService,
    private val lyricRepository: LyricRepository,
    /**
     * The whole YouTube search is retried as one unit, only for [TransientHttpErrors], and never past
     * the analysis deadline. Lyric providers retry each request themselves (`LyricProviderRetry`).
     */
    @Value("\${song-analysis.provider-retry.max-attempts:3}") providerMaxAttempts: Int,
    @Value("\${song-analysis.provider-retry.initial-backoff:1s}") providerInitialBackoff: Duration,
) {

    private val logger = LoggerFactory.getLogger(SongAnalysisPreparationService::class.java)
    private val providerBackoff = ExponentialBackoff(providerMaxAttempts, providerInitialBackoff)

    data class PreparedLyric(
        val lyricType: LyricType,
        val lines: List<LyricLineData>,
        val lrclibId: Long?,
        val vocadbId: Long?,
        val utaitedbId: Long? = null,
    )

    data class SongLyricCreationResult(
        val song: SongEntity,
        val lyric: LyricEntity,
    )

    suspend fun prepareLyrics(title: String, artist: String, durationSeconds: Int?): PreparedLyric {
        val (lyricsResult, parsedLines) = searchLyrics(title, artist, durationSeconds)
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
            utaitedbId = lyricsResult.utaitedbId,
        )
    }

    /** A null url means YouTube answered and no candidate passed; an error that survives retry propagates. */
    suspend fun searchYoutube(title: String, artist: String, durationSeconds: Int?, songId: Long? = null): MvSearchResult {
        val official = artistYoutubeChannelService.officialChannelIds(songId, artist)
        return withProviderRetry("YouTube") { youtubeMvSearchService.search(title, artist, durationSeconds, official) }
    }

    suspend fun acceptsCurrentMv(videoId: String, title: String, artist: String, durationSeconds: Int?, songId: Long?): Boolean {
        val official = artistYoutubeChannelService.officialChannelIds(songId, artist)
        return withProviderRetry("YouTube") { youtubeMvSearchService.acceptsAsOnlyCandidate(videoId, title, artist, durationSeconds, official) }
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
                    utaitedbId = preparedLyric.utaitedbId,
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
                    vocadbId = preparedLyric.vocadbId,
                    utaitedbId = preparedLyric.utaitedbId,
                )
        )
        savedSong.activeLyricId = lyric.id
        songRepository.save(savedSong)
        return SongLyricCreationResult(savedSong, lyric)
    }

    /**
     * 분석이 끝난 가사를 곡의 활성 가사로 저장한다. 곡이 이미 있어도 새 가사를 만든다 — 분석한 것이
     * 이 가사이므로, 분석이 안 된 채 남은 기존 활성 가사를 재사용하면 줄이 어긋날 수 있다.
     */
    fun saveSongWithNewActiveLyric(
        title: String,
        artist: String,
        durationSeconds: Int?,
        artworkUrl: String?,
        youtubeUrl: String?,
        preparedLyric: PreparedLyric,
    ): SongLyricCreationResult {
        val song = songRepository.findByArtistAndTitle(artist, title)
            ?: songRepository.save(
                SongEntity(
                    title = title,
                    artist = artist,
                    durationSeconds = durationSeconds,
                    youtubeUrl = youtubeUrl,
                    artworkUrl = artworkUrl,
                )
            )
        val lyric = createReplacementLyricForSong(song.id!!, preparedLyric).lyric
        song.activeLyricId = lyric.id
        if (song.youtubeUrl == null) song.youtubeUrl = youtubeUrl
        songRepository.save(song)
        return SongLyricCreationResult(song, lyric)
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
                utaitedbId = preparedLyric.utaitedbId,
            )
        )
        return SongLyricCreationResult(song, lyric)
    }

    private suspend fun searchLyrics(title: String, artist: String, durationSeconds: Int?): Pair<LyricsResult, List<ParsedLyricLine>> {
        if (LanguageVersion.isNonJapanese(title)) {
            logger.warn("Not a Japanese version, skipping lyric search: '{}' by '{}'", title, artist)
            throw BusinessException(ErrorCode.LYRICS_NOT_FOUND)
        }
        val query = SongQueryNormalizer.normalize(title, artist, durationSeconds)
        logger.info(
            "Lyric search started: '{}' by '{}' (normalized title: '{}', artist parts: {})",
            title, artist, query.normalizedTitle, query.artistParts
        )

        // A provider that stayed down does not stop the next one, but it does stop the verdict: with
        // one source unanswered, "no lyrics anywhere" is not known, so the outage is what propagates.
        var outage: Exception? = null
        for (provider in lyricProviders) {
            logger.info("Trying provider: {}", provider.providerName)
            val result = try {
                provider.search(query)
            } catch (e: Exception) {
                if (!TransientHttpErrors.isTransient(e)) throw e
                logger.warn("Provider {} unavailable after retries: {}", provider.providerName, e.message)
                outage = e
                continue
            }
            if (result != null) {
                val lines = lrcParser.parse(result.lyrics, result.isSynced)
                if (lines.isEmpty()) {
                    // An empty lyric saved as active would leave the song with no lines for good.
                    logger.warn("Provider {} returned lyrics with no parsable line (lrclibId={})", provider.providerName, result.lrclibId)
                    continue
                }
                logger.info(
                    "Lyrics found via {} (synced={}, lrclibId={}, vocadbId={}, utaitedbId={})",
                    provider.providerName, result.isSynced, result.lrclibId, result.vocadbId, result.utaitedbId
                )
                return result to lines
            }
            logger.info("Provider {}: no results", provider.providerName)
        }

        outage?.let { throw it }
        logger.warn("All lyric providers exhausted for: '{}' by '{}'", title, artist)
        throw BusinessException(ErrorCode.LYRICS_NOT_FOUND)
    }

    private suspend fun <T> withProviderRetry(provider: String, call: () -> T): T =
        providerBackoff.retry(
            isTransient = TransientHttpErrors::isTransient,
            atLeast = TransientHttpErrors::retryAfter,
            onRetry = { attempt, e, wait ->
                logger.warn("{} attempt {} failed, retrying in {}ms: {}", provider, attempt, wait.toMillis(), e.message)
            },
            deadline = currentRetryDeadline(),
            sleep = { delay(it.toMillis()) },
        ) {
            withContext(Dispatchers.IO) { call() }
        }
}
