package com.japanese.vocabulary.admin.controller

import com.japanese.vocabulary.admin.dto.AdminRecommendationAddRequest
import com.japanese.vocabulary.admin.dto.AdminRecommendationOrderRequest
import com.japanese.vocabulary.admin.dto.AdminRecommendationResponse
import com.japanese.vocabulary.recommendation.dto.RecommendedSongDto
import com.japanese.vocabulary.recommendation.service.RecommendedSongService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/admin/api/recommendations")
class AdminRecommendationController(
    private val recommendedSongService: RecommendedSongService,
) {
    @GetMapping
    fun list(): List<AdminRecommendationResponse> =
        recommendedSongService.list().map { it.toAdminResponse() }

    @PostMapping
    fun add(@RequestBody request: AdminRecommendationAddRequest): ResponseEntity<AdminRecommendationResponse> =
        ResponseEntity.status(HttpStatus.CREATED)
            .body(recommendedSongService.add(request.songId).toAdminResponse())

    @DeleteMapping("/{id}")
    fun remove(@PathVariable id: Long): ResponseEntity<Void> {
        recommendedSongService.remove(id)
        return ResponseEntity.noContent().build()
    }

    @PutMapping("/order")
    fun reorder(@RequestBody request: AdminRecommendationOrderRequest): List<AdminRecommendationResponse> =
        recommendedSongService.reorder(request.ids).map { it.toAdminResponse() }
}

private fun RecommendedSongDto.toAdminResponse() =
    AdminRecommendationResponse(
        id = id,
        songId = songId,
        title = title,
        artist = artist,
        artworkUrl = artworkUrl,
        orderIndex = orderIndex,
        createdAt = createdAt,
    )
