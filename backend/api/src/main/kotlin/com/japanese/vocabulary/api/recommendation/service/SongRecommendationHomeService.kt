package com.japanese.vocabulary.api.recommendation.service

import com.japanese.vocabulary.recommendation.dto.SongRecommendationResponse
import com.japanese.vocabulary.recommendation.service.RecommendedSongService
import org.springframework.stereotype.Service

@Service
class SongRecommendationHomeService(
    private val recommendedSongService: RecommendedSongService,
) {
    fun getRecommendations(): List<SongRecommendationResponse> =
        recommendedSongService.list().map { recommendation ->
            SongRecommendationResponse(
                id = recommendation.id,
                songId = recommendation.songId,
                title = recommendation.title,
                artist = recommendation.artist,
                artworkUrl = recommendation.artworkUrl,
            )
        }
}
