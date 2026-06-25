package com.japanese.vocabulary.recommendation.batch

import com.japanese.vocabulary.recommendation.service.SongRecommendationService
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.songanalysis.repository.SongAnalysisWorkRepository
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

@Component
class SongRecommendationCompletionReconciler(
    private val recommendationService: SongRecommendationService,
    private val workRepository: SongAnalysisWorkRepository,
    private val lyricRepository: LyricRepository,
    @Value("\${recommendation.completion-reconciler.batch-size:10}") private val batchSize: Int,
) {
    private val logger = LoggerFactory.getLogger(SongRecommendationCompletionReconciler::class.java)

    @Scheduled(fixedRateString = "\${recommendation.completion-reconciler.fixed-rate-ms:60000}")
    fun reconcileCompletedWork() {
        val candidates = recommendationService.findApprovedCandidatesAwaitingRecommendation(batchSize)
        if (candidates.isEmpty()) return

        candidates.forEach { candidate ->
            val workId = candidate.songAnalysisWorkId ?: return@forEach
            val work = workRepository.findById(workId).orElse(null) ?: return@forEach
            if (work.status != SongAnalysisWorkStatus.COMPLETED) return@forEach
            if (work.playerReadyAt == null || work.songId == null || work.lyricId == null) return@forEach

            val lyric = lyricRepository.findById(work.lyricId!!).orElse(null) ?: return@forEach
            if (lyric.analyzedContent == null) return@forEach

            try {
                val recommendation = recommendationService.createPendingRecommendation(
                    candidateId = candidate.id,
                    songId = work.songId!!,
                    lyricId = work.lyricId!!,
                )
                logger.info(
                    "Created pending song recommendation: candidateId={}, workId={}, recommendationId={}",
                    candidate.id,
                    work.id,
                    recommendation.id,
                )
            } catch (e: Exception) {
                logger.error(
                    "Failed to create pending song recommendation: candidateId={}, workId={}",
                    candidate.id,
                    work.id,
                    e,
                )
            }
        }
    }
}
