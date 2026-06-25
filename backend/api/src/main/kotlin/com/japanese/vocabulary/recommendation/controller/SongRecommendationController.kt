package com.japanese.vocabulary.recommendation.controller

import com.japanese.vocabulary.api.recommendation.service.SongRecommendationHomeService
import com.japanese.vocabulary.recommendation.dto.SongRecommendationResponse
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/songs/recommendations")
class SongRecommendationController(
    private val songRecommendationHomeService: SongRecommendationHomeService,
) {
    @GetMapping
    fun getRecommendations(): ResponseEntity<List<SongRecommendationResponse>> =
        ResponseEntity.ok(songRecommendationHomeService.getLatestPublishedRecommendations())
}
