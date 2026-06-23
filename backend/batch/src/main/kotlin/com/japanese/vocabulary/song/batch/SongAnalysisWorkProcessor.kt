package com.japanese.vocabulary.song.batch

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.song.entity.SongAnalysisWorkStage
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.service.LyricProcessingService
import com.japanese.vocabulary.song.service.SongAnalysisWorkService
import com.japanese.vocabulary.translation.service.KoreanLyricTranslationService
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

@Component
class SongAnalysisWorkProcessor(
    private val workService: SongAnalysisWorkService,
    private val lyricProcessingService: LyricProcessingService,
    private val translationService: KoreanLyricTranslationService,
    private val lyricRepository: LyricRepository,
) {
    private val logger = LoggerFactory.getLogger(SongAnalysisWorkProcessor::class.java)

    suspend fun process(work: SongAnalysisWorkEntity): Boolean {
        val workId = work.id ?: return false
        val workerId = work.lockedBy ?: return false
        return try {
            val lyric = resolveOrCreatePlayerReadyLyric(work, workerId) ?: return false
            if (!workService.markStage(workId, workerId, SongAnalysisWorkStage.ANALYZE_LYRICS)) return false
            val analyzedLines = translationService.runPipeline(lyric)
            if (!workService.completeWithAnalyzedContent(workId, workerId, lyric.id!!, analyzedLines)) return false
            logger.info("[workId={}] Song analysis completed", work.id)
            true
        } catch (e: Exception) {
            val code = errorCode(e)
            val message = errorMessage(e)
            workService.markFailed(workId, workerId, code, message)
            logger.error("[workId={}] Song analysis failed with {}", work.id, code, e)
            false
        }
    }

    private fun resolveOrCreatePlayerReadyLyric(work: SongAnalysisWorkEntity, workerId: String): LyricEntity? {
        val existingLyric = work.lyricId?.let { lyricRepository.findById(it).orElse(null) }
        if (existingLyric != null && work.songId != null) {
            if (!workService.markPlayerReady(work.id!!, workerId, work.songId!!, existingLyric.id!!)) return null
            return existingLyric
        }

        if (!workService.markStage(work.id!!, workerId, SongAnalysisWorkStage.FETCH_LYRICS)) return null
        val preparedLyric = lyricProcessingService.prepareLyrics(
            title = work.rawTitle,
            artist = work.rawArtist,
            durationSeconds = work.durationSeconds,
        )

        if (!workService.markStage(work.id!!, workerId, SongAnalysisWorkStage.FETCH_YOUTUBE)) return null
        val youtubeUrl = lyricProcessingService.searchYoutubeUrl(work.rawTitle, work.rawArtist)

        if (!workService.markStage(work.id!!, workerId, SongAnalysisWorkStage.CREATE_SONG_AND_LYRIC)) return null
        val created = lyricProcessingService.saveSongAndLyric(
            title = work.rawTitle,
            artist = work.rawArtist,
            durationSeconds = work.durationSeconds,
            artworkUrl = work.artworkUrl,
            youtubeUrl = youtubeUrl,
            preparedLyric = preparedLyric,
        )
        if (!workService.markPlayerReady(work.id!!, workerId, created.song.id!!, created.lyric.id!!)) return null
        return created.lyric
    }

    private fun errorCode(error: Exception): String {
        return when (error) {
            is BusinessException -> error.errorCode.name
            else -> ErrorCode.SONG_ANALYSIS_WORK_FAILED.name
        }
    }

    private fun errorMessage(error: Exception): String {
        return when (error) {
            is BusinessException -> error.errorCode.message
            else -> ErrorCode.SONG_ANALYSIS_WORK_FAILED.message
        }
    }
}
