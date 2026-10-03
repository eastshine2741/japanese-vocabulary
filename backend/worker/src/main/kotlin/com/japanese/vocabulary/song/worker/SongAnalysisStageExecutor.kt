package com.japanese.vocabulary.song.worker

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.service.SongAnalysisPreparationService
import com.japanese.vocabulary.songanalysis.dto.ClaimedSongAnalysisStage
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStage
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
import com.japanese.vocabulary.translation.client.gemini.GeminiCallContext
import com.japanese.vocabulary.translation.model.TranslationPipelineSource
import com.japanese.vocabulary.translation.service.KoreanLyricTranslationService
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

/**
 * 단계 하나를 실행하고 산출물을 원장에 남긴다. 앞 단계 산출물은 원장에서 읽으므로, 실패한 단계부터
 * 다시 돌려도 앞 단계를 반복하지 않는다.
 *
 * 실패는 던져서 알린다. 기록은 [SongAnalysisWorkListener] 가 한다. 원장 쓰기가 펜스에 걸리면
 * (다른 worker 가 넘겨받았거나 sweeper 가 포기 처리했으면) [SongAnalysisStageSupersededException] 이다.
 */
@Component
class SongAnalysisStageExecutor(
    private val workService: SongAnalysisWorkService,
    private val preparationService: SongAnalysisPreparationService,
    private val songCreator: SongAnalysisSongCreator,
    private val completionService: SongAnalysisWorkCompletionService,
    private val translationService: KoreanLyricTranslationService,
    private val lyricRepository: LyricRepository,
    private val codec: SongAnalysisStageCodec,
) {
    private val logger = LoggerFactory.getLogger(SongAnalysisStageExecutor::class.java)

    suspend fun execute(claimed: ClaimedSongAnalysisStage) {
        when (claimed.ref.stage) {
            SongAnalysisWorkStage.FETCH_LYRICS -> fetchLyrics(claimed)
            SongAnalysisWorkStage.FETCH_YOUTUBE -> fetchYoutube(claimed)
            SongAnalysisWorkStage.CREATE_SONG_AND_LYRIC -> createSongAndLyric(claimed)
            SongAnalysisWorkStage.ANALYZE_LYRICS -> analyzeLyrics(claimed)
            SongAnalysisWorkStage.SELECT_SENSES -> selectSenses(claimed)
            SongAnalysisWorkStage.TRANSLATE_SENSES -> translateSenses(claimed)
            SongAnalysisWorkStage.COMPLETE -> complete(claimed)
        }
    }

    private suspend fun fetchLyrics(claimed: ClaimedSongAnalysisStage) {
        val work = claimed.work
        val prepared: FetchLyricsOutput = preparationService.prepareLyrics(work.rawTitle, work.rawArtist, work.durationSeconds)
        finish(claimed, prepared)
    }

    private suspend fun fetchYoutube(claimed: ClaimedSongAnalysisStage) {
        val work = claimed.work
        // YouTube 가 답했고 후보가 없었다는 뜻이다. 오류는 이미 위로 던져졌다.
        val url = preparationService.searchYoutubeUrl(work.rawTitle, work.rawArtist, work.durationSeconds)
            ?: throw BusinessException(ErrorCode.SONG_ANALYSIS_WORK_FAILED)
        finish(claimed, FetchYoutubeOutput(url))
    }

    private fun createSongAndLyric(claimed: ClaimedSongAnalysisStage) {
        val outputs = Outputs(claimed)
        songCreator.create(
            claimed = claimed,
            preparedLyric = outputs.read(SongAnalysisWorkStage.FETCH_LYRICS, FetchLyricsOutput::class.java),
            youtubeUrl = outputs.read(SongAnalysisWorkStage.FETCH_YOUTUBE, FetchYoutubeOutput::class.java).youtubeUrl,
        )
    }

    /**
     * 번역과 단어 준비(분절 → 규칙·사전)를 동시에 돌린다. 갈래가 하나 끝날 때마다 산출물을 남기므로,
     * 다른 갈래가 실패해도 끝난 갈래는 다음 시도가 다시 하지 않는다.
     */
    private suspend fun analyzeLyrics(claimed: ClaimedSongAnalysisStage) {
        val source = sourceOf(claimed)
        var state = claimed.previousOutput?.let { codec.read(it, AnalyzeLyricsOutput::class.java) } ?: AnalyzeLyricsOutput()
        if (claimed.previousOutput != null) {
            logger.info(
                "[workId={}] Resuming ANALYZE_LYRICS with translation={} segmentation={} words={}",
                claimed.ref.workId, state.translation != null, state.segmentation != null, state.words != null,
            )
        }
        val mutex = Mutex()
        suspend fun record(update: (AnalyzeLyricsOutput) -> AnalyzeLyricsOutput) = mutex.withLock {
            state = update(state)
            if (!workService.recordProgress(claimed.ref, codec.write(state))) {
                throw SongAnalysisStageSupersededException(claimed.ref)
            }
        }
        val resumed = state

        coroutineScope {
            if (resumed.translation == null) {
                launch {
                    val translation = translationService.translateLyrics(source)
                    record { it.copy(translation = translation) }
                }
            }
            if (resumed.words == null) {
                launch {
                    val segmentation = resumed.segmentation ?: translationService.segmentLyrics(source)
                        .also { segmented -> record { it.copy(segmentation = segmented) } }
                    val words = translationService.resolveWords(segmentation)
                    record { it.copy(words = words) }
                }
            }
        }
        finish(claimed, state)
    }

    private suspend fun selectSenses(claimed: ClaimedSongAnalysisStage) {
        val source = sourceOf(claimed)
        val analyzed = Outputs(claimed).analyzed()
        val selected = translationService.selectSenses(source, analyzed.translation!!, analyzed.words!!)
        finish(claimed, SelectSensesOutput(selected))
    }

    private suspend fun translateSenses(claimed: ClaimedSongAnalysisStage) {
        val source = sourceOf(claimed)
        val outputs = Outputs(claimed)
        val selected = outputs.read(SongAnalysisWorkStage.SELECT_SENSES, SelectSensesOutput::class.java)
        val korean = translationService.translateSenses(selected.selectedSenseByKey, outputs.analyzed().words!!, source.callContext)
        finish(claimed, TranslateSensesOutput(korean))
    }

    private suspend fun complete(claimed: ClaimedSongAnalysisStage) {
        val source = sourceOf(claimed)
        val outputs = Outputs(claimed)
        val analyzed = outputs.analyzed()
        val lines = translationService.assemble(
            source = source,
            translationMap = analyzed.translation!!,
            wordPreparation = analyzed.words!!,
            selectedSenseByKey = outputs.read(SongAnalysisWorkStage.SELECT_SENSES, SelectSensesOutput::class.java).selectedSenseByKey,
            koreanBySenseId = outputs.read(SongAnalysisWorkStage.TRANSLATE_SENSES, TranslateSensesOutput::class.java).koreanBySenseId,
        )
        completionService.completeWithAnalyzedContent(
            ref = claimed.ref,
            preparedLyric = outputs.read(SongAnalysisWorkStage.FETCH_LYRICS, FetchLyricsOutput::class.java),
            youtubeUrl = outputs.read(SongAnalysisWorkStage.FETCH_YOUTUBE, FetchYoutubeOutput::class.java).youtubeUrl,
            analyzedLines = lines,
            output = codec.write(CompleteOutput(analyzedLines = lines.size)),
        )
        logger.info("[workId={}] Song analysis completed", claimed.ref.workId)
    }

    private fun finish(claimed: ClaimedSongAnalysisStage, output: Any) {
        if (!workService.completeStage(claimed.ref, codec.write(output))) {
            throw SongAnalysisStageSupersededException(claimed.ref)
        }
    }

    /**
     * 분석할 가사. 곡·가사 행은 [SongAnalysisWorkStage.COMPLETE] 에서야 생기므로 FETCH_LYRICS 산출물을
     * 읽는다. CREATE_SONG_AND_LYRIC 을 거친 옛 작업은 기존 가사를 재사용했을 수 있어, 그 가사를 읽는다.
     */
    private fun sourceOf(claimed: ClaimedSongAnalysisStage): TranslationPipelineSource {
        claimed.work.lyricId?.let { lyricId ->
            val lyric = lyricRepository.findById(lyricId).orElseThrow { BusinessException(ErrorCode.LYRIC_NOT_FOUND) }
            return translationService.sourceOf(lyric, claimed.ref.workId)
        }
        val prepared = Outputs(claimed).read(SongAnalysisWorkStage.FETCH_LYRICS, FetchLyricsOutput::class.java)
        val context = GeminiCallContext(songId = claimed.work.songId, lyricId = null, workId = claimed.ref.workId)
        return TranslationPipelineSource.from(prepared.lines, context)
    }

    /** 앞 단계 산출물. 없으면 원장이 깨진 것이라 이 단계는 실패로 기록된다. */
    private inner class Outputs(private val claimed: ClaimedSongAnalysisStage) {
        private val byStage = workService.completedOutputs(claimed.ref.workId)

        fun <T> read(stage: SongAnalysisWorkStage, type: Class<T>): T {
            val json = checkNotNull(byStage[stage]) { "Work ${claimed.ref.workId} has no output from $stage" }
            return codec.read(json, type)
        }

        fun analyzed(): AnalyzeLyricsOutput = read(SongAnalysisWorkStage.ANALYZE_LYRICS, AnalyzeLyricsOutput::class.java)
            .also { check(it.translation != null && it.words != null) { "ANALYZE_LYRICS output is incomplete" } }
    }
}
