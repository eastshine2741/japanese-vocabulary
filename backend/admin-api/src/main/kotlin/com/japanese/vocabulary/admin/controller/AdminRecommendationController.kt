package com.japanese.vocabulary.admin.controller

import com.japanese.vocabulary.admin.dto.AdminRecommendationOperationResponse
import com.japanese.vocabulary.recommendation.dto.RecommendationOperationItemDto
import com.japanese.vocabulary.recommendation.dto.RecommendationOperationResultDto
import com.japanese.vocabulary.recommendation.service.SongRecommendationService
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/admin/api/recommendations")
class AdminRecommendationController(
    private val recommendationService: SongRecommendationService,
) {
    @PostMapping("/dispatch-analysis")
    fun dispatchApprovedCandidates(
        @RequestParam(defaultValue = "10") limit: Int,
    ): AdminRecommendationOperationResponse =
        recommendationService.dispatchApprovedCandidates(limit.coerceIn(MIN_LIMIT, MAX_LIMIT)).toAdminResponse()

    @PostMapping("/reconcile-completed")
    fun reconcileCompletedWork(
        @RequestParam(defaultValue = "10") limit: Int,
    ): AdminRecommendationOperationResponse =
        recommendationService.reconcileCompletedWork(limit.coerceIn(MIN_LIMIT, MAX_LIMIT)).toAdminResponse()

    companion object {
        private const val MIN_LIMIT = 1
        private const val MAX_LIMIT = 100
    }
}

private fun RecommendationOperationResultDto.toAdminResponse(): AdminRecommendationOperationResponse =
    AdminRecommendationOperationResponse(
        processed = processed,
        succeeded = succeeded,
        skipped = skipped,
        failed = failed,
        items = items.map { it.toAdminResponse() },
    )

private fun RecommendationOperationItemDto.toAdminResponse() =
    com.japanese.vocabulary.admin.dto.AdminRecommendationOperationItemResponse(
        candidateId = candidateId,
        status = status,
        workId = workId,
        recommendationId = recommendationId,
        message = message,
    )
