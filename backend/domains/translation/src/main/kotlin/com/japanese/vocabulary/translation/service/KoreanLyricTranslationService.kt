package com.japanese.vocabulary.translation.service

import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.translation.model.AssembleAnalyzedLinesInput
import com.japanese.vocabulary.translation.model.SenseSelectionStageInput
import com.japanese.vocabulary.translation.model.SenseTranslationStageInput
import com.japanese.vocabulary.translation.model.TranslationPipelineSource
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
 * over a single [LyricEntity]. Work polling, stage transitions, and terminal failure handling live
 * in the batch module's song-analysis work scheduler/processor.
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
     */
    suspend fun runPipeline(entity: LyricEntity): List<AnalyzedLine> {
        logger.info("[songId={}] Starting translation", entity.songId)

        val source = TranslationPipelineSource.from(entity.rawContent)
        logger.info("[songId={}] Parsed {} lyric lines", entity.songId, source.lyricLines.size)

        logger.info("[songId={}] Calling Gemini APIs (translation ∥ segment→validate→lexical)...", entity.songId)
        val (translationMap, wordPreparation) = coroutineScope {
            val translationDeferred = async { translateLyricsStage.execute(source) }
            val wordPrepDeferred = async {
                val segmented = segmentLyricsStage.execute(source)
                val ruleResolved = applyRuleMeaningsStage.execute(segmented)
                resolveLexicalSensesStage.execute(ruleResolved)
            }
            translationDeferred.await() to wordPrepDeferred.await()
        }

        logger.info(
            "[songId={}] Gemini responded: {} translated lines, {} segmented lines, {} lexical senses",
            entity.songId,
            translationMap.size,
            wordPreparation.segLines.size,
            wordPreparation.lexical.optionsById.size,
        )

        val selectedSenseByKey = selectSensesStage.execute(
            SenseSelectionStageInput(
                source = source,
                translationMap = translationMap,
                wordPreparation = wordPreparation,
            ),
        )
        val koreanBySenseId = translateSensesStage.execute(
            SenseTranslationStageInput(
                selectedSenseByKey = selectedSenseByKey,
                lexical = wordPreparation.lexical,
            ),
        )

        return assembleAnalyzedLinesStage.execute(
            AssembleAnalyzedLinesInput(
                source = source,
                translationMap = translationMap,
                wordPreparation = wordPreparation,
                selectedSenseByKey = selectedSenseByKey,
                koreanBySenseId = koreanBySenseId,
            ),
        )
    }

    @Transactional
    fun saveAnalyzedContent(entity: LyricEntity, lines: List<AnalyzedLine>) {
        entity.analyzedContent = lines
        lyricRepository.save(entity)
        logger.info("[songId={}] Analyzed lyric content saved", entity.songId)
    }
}
