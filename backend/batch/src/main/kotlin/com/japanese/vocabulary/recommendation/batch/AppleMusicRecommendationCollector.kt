package com.japanese.vocabulary.recommendation.batch

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.applemusicrss.client.AppleMusicRssClient
import com.japanese.vocabulary.recommendation.dto.RecommendationCandidateInputDto
import com.japanese.vocabulary.recommendation.entity.RecommendationSource
import com.japanese.vocabulary.recommendation.service.SongRecommendationService
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.time.LocalDate

@Component
class AppleMusicRecommendationCollector(
    private val appleMusicRssClient: AppleMusicRssClient,
    private val recommendationService: SongRecommendationService,
    private val weekCalculator: RecommendationWeekCalculator,
    private val objectMapper: ObjectMapper,
    @Value("\${recommendation.apple-rss.storefront:jp}") private val storefront: String,
    @Value("\${recommendation.apple-rss.limit:100}") private val limit: Int,
) {
    private val logger = LoggerFactory.getLogger(AppleMusicRecommendationCollector::class.java)

    @Scheduled(cron = "\${recommendation.apple-rss.collect-cron:0 0 3 ? * MON}", zone = "Asia/Tokyo")
    fun collectWeeklyCandidates() {
        val weekStartDate = weekCalculator.currentWeekStartDate()
        collect(weekStartDate)
    }

    fun collect(weekStartDate: LocalDate) {
        val songs = appleMusicRssClient.fetchMostPlayedSongs(storefront = storefront, limit = limit)
        val inputs = songs.map { song ->
            RecommendationCandidateInputDto(
                sourceSongId = song.id,
                sourceRank = song.rank,
                title = song.name,
                artistName = song.artistName,
                artworkUrl = song.artworkUrl100,
                sourceUrl = song.url,
                sourceArtistId = song.artistId,
                sourceArtistUrl = song.artistUrl,
                releaseDate = song.releaseDate?.let { LocalDate.parse(it) },
                genresJson = objectMapper.writeValueAsString(song.genres),
            )
        }

        val upserted = recommendationService.upsertCandidates(
            source = RecommendationSource.APPLE_MUSIC_RSS,
            weekStartDate = weekStartDate,
            candidates = inputs,
        )

        logger.info(
            "Collected Apple Music recommendation candidates: weekStartDate={}, count={}",
            weekStartDate,
            upserted.size,
        )
    }
}
