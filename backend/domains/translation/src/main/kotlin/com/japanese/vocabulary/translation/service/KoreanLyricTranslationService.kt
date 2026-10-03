package com.japanese.vocabulary.translation.service

import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.translation.client.gemini.GeminiCallContext
import com.japanese.vocabulary.translation.client.gemini.dto.TranslationResultDto
import com.japanese.vocabulary.translation.model.AssembleAnalyzedLinesInput
import com.japanese.vocabulary.translation.model.PipelineTokenKey
import com.japanese.vocabulary.translation.model.SegmentationStageResult
import com.japanese.vocabulary.translation.model.SenseSelectionStageInput
import com.japanese.vocabulary.translation.model.SenseTranslationStageInput
import com.japanese.vocabulary.translation.model.TranslationPipelineSource
import com.japanese.vocabulary.translation.model.WordPreparationResult
import com.japanese.vocabulary.translation.service.pipeline.stage.ApplyRuleMeaningsStage
import com.japanese.vocabulary.translation.service.pipeline.stage.AssembleAnalyzedLinesStage
import com.japanese.vocabulary.translation.service.pipeline.stage.ResolveLexicalSensesStage
import com.japanese.vocabulary.translation.service.pipeline.stage.SegmentLyricsStage
import com.japanese.vocabulary.translation.service.pipeline.stage.SelectSensesStage
import com.japanese.vocabulary.translation.service.pipeline.stage.TranslateLyricsStage
import com.japanese.vocabulary.translation.service.pipeline.stage.TranslateSensesStage
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * Domain-level lyric translation operations. Exposes pure compute and analyzed-content persistence
 * over a single [LyricEntity]. Queue handling, stage transitions, and terminal failure handling live
 * in the worker module.
 */
@Service
class KoreanLyricTranslationService(
    private val lyricRepository: LyricRepository,
    private val translateLyricsStage: TranslateLyricsStage,
    private val segmentLyricsStage: SegmentLyricsStage,
    private val applyRuleMeaningsStage: ApplyRuleMeaningsStage,
    private val resolveLexicalSensesStage: ResolveLexicalSensesStage,
    private val selectSensesStage: SelectSensesStage,
    private val translateSensesStage: TranslateSensesStage,
    private val assembleAnalyzedLinesStage: AssembleAnalyzedLinesStage,
) {
    private val logger = LoggerFactory.getLogger("KoreanLyricTranslation")

    /**
     * Pure compute: `(translation ∥ [segment → validate/retry → rules → lexical]) → sense-select
     * → translate-sense → assemble`. No DB writes.
     *
     * The worker runs the same steps one queue message at a time through the methods below, so it
     * can keep each step's output and resume from the one that failed. This composes them in one go.
     */
    suspend fun runPipeline(entity: LyricEntity): List<AnalyzedLine> {
        logger.info("[songId={}] Starting translation", entity.songId)
        val source = sourceOf(entity)
        logger.info("[songId={}] Parsed {} lyric lines", entity.songId, source.lyricLines.size)

        logger.info("[songId={}] Calling Gemini APIs (translation ∥ segment→validate→lexical)...", entity.songId)
        val (translationMap, wordPreparation) = coroutineScope {
            val translationDeferred = async { translateLyrics(source) }
            val wordPrepDeferred = async { resolveWords(segmentLyrics(source)) }
            translationDeferred.await() to wordPrepDeferred.await()
        }

        logger.info(
            "[songId={}] Gemini responded: {} translated lines, {} segmented lines, {} lexical senses",
            entity.songId,
            translationMap.size,
            wordPreparation.segLines.size,
            wordPreparation.lexical.optionsById.size,
        )

        val selectedSenseByKey = selectSenses(source, translationMap, wordPreparation)
        val koreanBySenseId = translateSenses(selectedSenseByKey, wordPreparation, source.callContext)
        return assemble(source, translationMap, wordPreparation, selectedSenseByKey, koreanBySenseId)
    }

    fun sourceOf(entity: LyricEntity): TranslationPipelineSource =
        TranslationPipelineSource.from(
            entity.rawContent,
            GeminiCallContext(songId = entity.songId, lyricId = entity.id),
        )

    suspend fun translateLyrics(source: TranslationPipelineSource): Map<Int, TranslationResultDto> =
        translateLyricsStage.execute(source)

    suspend fun segmentLyrics(source: TranslationPipelineSource): SegmentationStageResult =
        segmentLyricsStage.execute(source)

    /** Rules then dictionary. Rules are local and cheap, so they are not a step of their own. */
    suspend fun resolveWords(segmented: SegmentationStageResult): WordPreparationResult =
        resolveLexicalSensesStage.execute(applyRuleMeaningsStage.execute(segmented))

    suspend fun selectSenses(
        source: TranslationPipelineSource,
        translationMap: Map<Int, TranslationResultDto>,
        wordPreparation: WordPreparationResult,
    ): Map<PipelineTokenKey, Int> =
        selectSensesStage.execute(
            SenseSelectionStageInput(
                source = source,
                translationMap = translationMap,
                wordPreparation = wordPreparation,
            ),
        )

    suspend fun translateSenses(
        selectedSenseByKey: Map<PipelineTokenKey, Int>,
        wordPreparation: WordPreparationResult,
        callContext: GeminiCallContext,
    ): Map<Int, String> =
        translateSensesStage.execute(
            SenseTranslationStageInput(
                selectedSenseByKey = selectedSenseByKey,
                lexical = wordPreparation.lexical,
                callContext = callContext,
            ),
        )

    suspend fun assemble(
        source: TranslationPipelineSource,
        translationMap: Map<Int, TranslationResultDto>,
        wordPreparation: WordPreparationResult,
        selectedSenseByKey: Map<PipelineTokenKey, Int>,
        koreanBySenseId: Map<Int, String>,
    ): List<AnalyzedLine> =
        assembleAnalyzedLinesStage.execute(
            AssembleAnalyzedLinesInput(
                source = source,
                translationMap = translationMap,
                wordPreparation = wordPreparation,
                selectedSenseByKey = selectedSenseByKey,
                koreanBySenseId = koreanBySenseId,
            ),
        )

    @Transactional
    fun saveAnalyzedContent(entity: LyricEntity, lines: List<AnalyzedLine>) {
        entity.analyzedContent = lines
        lyricRepository.save(entity)
        logger.info("[songId={}] Analyzed lyric content saved", entity.songId)
    }
}
