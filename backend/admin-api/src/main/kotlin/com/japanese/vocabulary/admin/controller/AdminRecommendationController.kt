package com.japanese.vocabulary.admin.controller

import com.japanese.vocabulary.admin.dto.AdminRecommendationCandidateResponse
import com.japanese.vocabulary.admin.dto.AdminRecommendationCandidateStatusUpdateRequest
import com.japanese.vocabulary.admin.dto.AdminRecommendationAnalysisRequest
import com.japanese.vocabulary.admin.dto.AdminRecommendationOperationResponse
import com.japanese.vocabulary.admin.dto.AdminRecommendationResponse
import com.japanese.vocabulary.admin.dto.AdminRecommendationUpdateRequest
import com.japanese.vocabulary.recommendation.dto.RecommendationCandidateDto
import com.japanese.vocabulary.recommendation.dto.RecommendationOperationItemDto
import com.japanese.vocabulary.recommendation.dto.RecommendationOperationResultDto
import com.japanese.vocabulary.recommendation.dto.SongRecommendationDto
import com.japanese.vocabulary.recommendation.entity.RecommendationCandidateStatus
import com.japanese.vocabulary.recommendation.service.SongRecommendationService
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate

@RestController
@RequestMapping("/admin/api/recommendations")
class AdminRecommendationController(
    private val recommendationService: SongRecommendationService,
) {
    @GetMapping("/candidates")
    fun candidates(
        @RequestParam(required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        weekStartDate: LocalDate?,
        @RequestParam(required = false)
        status: RecommendationCandidateStatus?,
    ): List<AdminRecommendationCandidateResponse> =
        recommendationService.listCandidates(
            weekStartDate = weekStartDate,
            status = status,
        ).map { it.toAdminResponse() }

    @PatchMapping("/candidates/{candidateId}/status")
    fun updateCandidateStatus(
        @PathVariable candidateId: Long,
        @RequestBody request: AdminRecommendationCandidateStatusUpdateRequest,
    ): AdminRecommendationCandidateResponse =
        recommendationService.updateCandidateStatus(candidateId, request.status).toAdminResponse()

    @GetMapping
    fun recommendations(
        @RequestParam(required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        weekStartDate: LocalDate?,
    ): List<AdminRecommendationResponse> =
        recommendationService.listRecommendations(weekStartDate).map { it.toAdminResponse() }

    @PatchMapping("/{recommendationId}")
    fun updateRecommendation(
        @PathVariable recommendationId: Long,
        @RequestBody request: AdminRecommendationUpdateRequest,
    ): AdminRecommendationResponse =
        recommendationService.updateRecommendation(
            recommendationId = recommendationId,
            status = request.status,
            orderIndex = request.orderIndex,
        ).toAdminResponse()

    @PostMapping("/prepare-approved")
    fun prepareApprovedCandidates(
        @RequestParam(required = false)
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        weekStartDate: LocalDate?,
    ): ResponseEntity<AdminRecommendationOperationResponse> {
        val response = recommendationService.prepareApprovedCandidates(weekStartDate).toAdminResponse()
        val status = if (response.failed > 0) HttpStatus.UNPROCESSABLE_ENTITY else HttpStatus.OK
        return ResponseEntity.status(status).body(response)
    }

    @PostMapping("/request-analysis")
    fun requestAnalysis(
        @RequestBody request: AdminRecommendationAnalysisRequest,
    ): AdminRecommendationOperationResponse =
        recommendationService.requestAnalysisForCandidates(request.candidateIds).toAdminResponse()
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
        songId = songId,
        lyricId = lyricId,
        workId = workId,
        recommendationId = recommendationId,
        message = message,
    )

private fun RecommendationCandidateDto.toAdminResponse() =
    AdminRecommendationCandidateResponse(
        id = id,
        source = source.name,
        sourceSongId = sourceSongId,
        weekStartDate = weekStartDate,
        sourceRank = sourceRank,
        status = status.name,
        title = title,
        artistName = artistName,
        artworkUrl = artworkUrl,
        sourceUrl = sourceUrl,
        releaseDate = releaseDate,
        createdAt = createdAt,
        updatedAt = updatedAt,
    )

private fun SongRecommendationDto.toAdminResponse() =
    AdminRecommendationResponse(
        id = id,
        candidateId = candidateId,
        weekStartDate = weekStartDate,
        status = status.name,
        songId = songId,
        lyricId = lyricId,
        orderIndex = orderIndex,
        publishedAt = publishedAt,
        createdAt = createdAt,
        updatedAt = updatedAt,
    )
