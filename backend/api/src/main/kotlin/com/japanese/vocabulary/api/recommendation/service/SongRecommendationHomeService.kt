package com.japanese.vocabulary.api.recommendation.service

import com.japanese.vocabulary.recommendation.dto.SongRecommendationResponse
import com.japanese.vocabulary.recommendation.repository.SongRecommendationRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class SongRecommendationHomeService(
    private val recommendationRepository: SongRecommendationRepository,
) {
    @Transactional(readOnly = true)
    fun getLatestPublishedRecommendations(): List<SongRecommendationResponse> =
        recommendationRepository.findLatestPublishedReadyRecommendations().map { recommendation ->
            SongRecommendationResponse(
                id = recommendation.getId(),
                songId = recommendation.getSongId(),
                title = recommendation.getTitle(),
                artist = recommendation.getArtist(),
                artworkUrl = recommendation.getArtworkUrl(),
                weekStartDate = recommendation.getWeekStartDate(),
            )
        }
}
