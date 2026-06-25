package com.japanese.vocabulary.recommendation.batch

import com.japanese.vocabulary.recommendation.service.SongRecommendationService
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisTriggerSource
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

@Component
class SongRecommendationAnalysisDispatcher(
    private val recommendationService: SongRecommendationService,
    private val songAnalysisWorkService: SongAnalysisWorkService,
    @Value("\${recommendation.analysis-dispatcher.batch-size:10}") private val batchSize: Int,
) {
    private val logger = LoggerFactory.getLogger(SongRecommendationAnalysisDispatcher::class.java)

    @Scheduled(fixedRateString = "\${recommendation.analysis-dispatcher.fixed-rate-ms:60000}")
    fun dispatchApprovedCandidates() {
        val candidates = recommendationService.findApprovedCandidatesAwaitingAnalysis(batchSize)
        if (candidates.isEmpty()) return

        candidates.forEach { candidate ->
            try {
                val work = songAnalysisWorkService.createOrReuse(
                    title = candidate.title,
                    artist = candidate.artistName,
                    durationSeconds = candidate.durationSeconds,
                    artworkUrl = candidate.artworkUrl,
                    triggerSource = SongAnalysisTriggerSource.RECOMMENDATION,
                    createdByUserId = null,
                )
                recommendationService.linkAnalysisWork(candidate.id, work.workId)
                logger.info(
                    "Dispatched recommendation candidate analysis: candidateId={}, workId={}",
                    candidate.id,
                    work.workId,
                )
            } catch (e: Exception) {
                logger.error("Failed to dispatch recommendation candidate analysis: candidateId={}", candidate.id, e)
            }
        }
    }
}
