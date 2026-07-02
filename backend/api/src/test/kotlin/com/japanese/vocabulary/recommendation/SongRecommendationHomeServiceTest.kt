package com.japanese.vocabulary.recommendation

import com.japanese.vocabulary.api.recommendation.service.SongRecommendationHomeService
import com.japanese.vocabulary.recommendation.repository.PublishedSongRecommendationProjection
import com.japanese.vocabulary.recommendation.repository.SongRecommendationRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import java.time.LocalDate

class SongRecommendationHomeServiceTest {
    private val recommendationRepository = mock(SongRecommendationRepository::class.java)
    private val service = SongRecommendationHomeService(
        recommendationRepository = recommendationRepository,
    )

    @Test
    fun `returns empty list when there is no ready published recommendation`() {
        `when`(recommendationRepository.findLatestPublishedReadyRecommendations()).thenReturn(emptyList())

        val result = service.getLatestPublishedRecommendations()

        assertThat(result).isEmpty()
    }

    @Test
    fun `maps ready published recommendation projections`() {
        val latestWeek = LocalDate.of(2026, 6, 22)
        `when`(recommendationRepository.findLatestPublishedReadyRecommendations()).thenReturn(
            listOf(
                projection(
                    id = 1,
                    songId = 10,
                    title = "Ready",
                    artist = "Artist A",
                    artworkUrl = "https://example.com/a.jpg",
                    weekStartDate = latestWeek,
                ),
            )
        )

        val result = service.getLatestPublishedRecommendations()

        assertThat(result).hasSize(1)
        assertThat(result.first().id).isEqualTo(1)
        assertThat(result.first().songId).isEqualTo(10)
        assertThat(result.first().title).isEqualTo("Ready")
        assertThat(result.first().weekStartDate).isEqualTo(latestWeek)
    }

    private fun projection(
        id: Long,
        songId: Long,
        title: String,
        artist: String,
        artworkUrl: String?,
        weekStartDate: LocalDate,
    ) = object : PublishedSongRecommendationProjection {
        override fun getId(): Long = id
        override fun getSongId(): Long = songId
        override fun getTitle(): String = title
        override fun getArtist(): String = artist
        override fun getArtworkUrl(): String? = artworkUrl
        override fun getWeekStartDate(): LocalDate = weekStartDate
    }
}
