package com.japanese.vocabulary.song.worker

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.service.SongAnalysisPreparationService
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkEntity
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStage
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
import com.japanese.vocabulary.translation.service.KoreanLyricTranslationService
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

@Component
class SongAnalysisWorkProcessor(
    private val workService: SongAnalysisWorkService,
    private val completionService: SongAnalysisWorkCompletionService,
    private val preparationService: SongAnalysisPreparationService,
    private val translationService: KoreanLyricTranslationService,
    private val lyricRepository: LyricRepository,
) {
    private val logger = LoggerFactory.getLogger(SongAnalysisWorkProcessor::class.java)

    suspend fun process(work: SongAnalysisWorkEntity): Boolean {
        val workId = work.id ?: return false
        return try {
            val lyric = resolveOrCreatePlayerReadyLyric(work) ?: return false
            if (!workService.markStage(workId, SongAnalysisWorkStage.ANALYZE_LYRICS)) return false
            val analyzedLines = translationService.runPipeline(lyric)
            if (!completionService.completeWithAnalyzedContent(workId, lyric.id!!, analyzedLines)) return false
            logger.info("[workId={}] Song analysis completed", work.id)
            true
        } catch (e: Exception) {
            val code = errorCode(e)
            val message = errorMessage(e)
            workService.markFailed(workId, code, message)
            logger.error("[workId={}] Song analysis failed with {}", work.id, code, e)
            false
        }
    }

    private fun resolveOrCreatePlayerReadyLyric(work: SongAnalysisWorkEntity): LyricEntity? {
        val existingLyric = work.lyricId?.let { lyricRepository.findById(it).orElse(null) }
        if (existingLyric != null && work.songId != null) {
            if (!workService.markPlayerReady(work.id!!, work.songId!!, existingLyric.id!!, work.youtubeUrl)) return null
            return existingLyric
        }

        if (!workService.markStage(work.id!!, SongAnalysisWorkStage.FETCH_LYRICS)) return null
        val preparedLyric = preparationService.prepareLyrics(
            title = work.rawTitle,
            artist = work.rawArtist,
            durationSeconds = work.durationSeconds,
        )

        if (!workService.markStage(work.id!!, SongAnalysisWorkStage.FETCH_YOUTUBE)) return null
        val youtubeUrl = preparationService.searchYoutubeUrl(
            title = work.rawTitle,
            artist = work.rawArtist,
            durationSeconds = work.durationSeconds,
        )
            ?: throw BusinessException(ErrorCode.SONG_ANALYSIS_WORK_FAILED)

        if (!workService.markStage(work.id!!, SongAnalysisWorkStage.CREATE_SONG_AND_LYRIC)) return null
        val created = if (work.triggerSource == SongAnalysisTriggerSource.ADMIN && work.songId != null) {
            preparationService.createReplacementLyricForSong(work.songId!!, preparedLyric)
        } else {
            preparationService.saveSongAndLyric(
                title = work.rawTitle,
                artist = work.rawArtist,
                durationSeconds = work.durationSeconds,
                artworkUrl = work.artworkUrl,
                youtubeUrl = youtubeUrl,
                preparedLyric = preparedLyric,
            )
        }
        if (!workService.markPlayerReady(work.id!!, created.song.id!!, created.lyric.id!!, youtubeUrl)) return null
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
