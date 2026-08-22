package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.api.recommendation.service.SongRecommendationHomeService
import com.japanese.vocabulary.deck.service.DeckService
import com.japanese.vocabulary.song.dto.AnalyzedSongDto
import com.japanese.vocabulary.song.repository.SongRepository
import org.springframework.stereotype.Service

/**
 * Picks the home "Spotlight" song for a user.
 *
 * The candidate pool is the union of the user's recently played songs and the latest
 * published-ready weekly recommendations, minus every song the user already has a deck for.
 * A song present in both pools is one candidate, not two — the pick is an unweighted random
 * over distinct song ids, so a large recommendation set legitimately dominates a small
 * recent-listen history.
 */
@Service
class SpotlightService(
    private val recentSongService: RecentSongService,
    private val recommendationHomeService: SongRecommendationHomeService,
    private val deckService: DeckService,
    private val songRepository: SongRepository,
    private val songStudyViewService: SongStudyViewService,
) {
    /** Returns study data for the spotlighted song, or null when no candidate is eligible. */
    fun pickForUser(userId: Long): AnalyzedSongDto? {
        val spotlightId = candidateSongIds(userId).randomOrNull() ?: return null

        val entity = songRepository.findById(spotlightId).orElse(null) ?: return null
        return songStudyViewService.buildAnalyzedSong(entity)
    }

    /**
     * The eligible pool, deduplicated by song id so a song that is both recently played and
     * recommended does not get twice the chance of being picked.
     */
    fun candidateSongIds(userId: Long): List<Long> {
        val recentIds = recentSongService.getRecentSongIds(userId)
        val recommendedIds = recommendationHomeService.getLatestPublishedRecommendations().map { it.songId }
        val deckSongIds = deckService.getDeckSongIds(userId)

        return (recentIds + recommendedIds)
            .distinct()
            .filter { it !in deckSongIds }
    }
}
