package com.japanese.vocabulary.recommendation.batch

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.applemusicrss.client.AppleMusicRssClient
import com.japanese.vocabulary.recommendation.dto.RecommendationCandidateInputDto
import com.japanese.vocabulary.recommendation.entity.RecommendationSource
import com.japanese.vocabulary.recommendation.service.SongRecommendationService
import com.japanese.vocabulary.songsearch.client.itunes.ItunesClient
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.time.LocalDate

@Component
class AppleMusicRecommendationCollector(
    private val appleMusicRssClient: AppleMusicRssClient,
    private val itunesClient: ItunesClient,
    private val recommendationService: SongRecommendationService,
    private val weekCalculator: RecommendationWeekCalculator,
    private val objectMapper: ObjectMapper,
    @Value("\${recommendation.apple-rss.storefront:jp}") private val storefront: String,
    @Value("\${recommendation.apple-rss.limit:100}") private val limit: Int,
) {
    private val logger = LoggerFactory.getLogger(AppleMusicRecommendationCollector::class.java)

    fun collectWeeklyCandidates() {
        val weekStartDate = weekCalculator.currentWeekStartDate()
        collect(weekStartDate)
    }

    fun collect(weekStartDate: LocalDate) {
        val songs = appleMusicRssClient.fetchMostPlayedSongs(storefront = storefront, limit = limit)
        val durationsBySongId = lookupDurations(songs.map { it.id })
        val inputs = songs.map { song ->
            RecommendationCandidateInputDto(
                sourceSongId = song.id,
                sourceRank = song.rank,
                title = song.name,
                artistName = song.artistName,
                durationSeconds = durationsBySongId[song.id],
                artworkUrl = song.artworkUrl,
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
            "Collected Apple Music recommendation candidates: weekStartDate={}, count={}, withDuration={}",
            weekStartDate,
            upserted.size,
            inputs.count { it.durationSeconds != null },
        )
    }

    // The RSS feed carries no track length, but the downstream MV search needs it to reject
    // Shorts and live clips, so it is filled from the iTunes lookup by the feed's track id.
    // A lookup failure must not lose the week's chart; the candidate just stays without it.
    private fun lookupDurations(songIds: List<String>): Map<String, Int> =
        runCatching { itunesClient.lookupTrackDurations(songIds) }
            .getOrElse { e ->
                logger.warn("iTunes duration lookup failed for {} chart songs: {}", songIds.size, e.message)
                emptyMap()
            }
}
