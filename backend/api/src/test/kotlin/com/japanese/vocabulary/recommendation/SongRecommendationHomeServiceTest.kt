package com.japanese.vocabulary.recommendation

import com.japanese.vocabulary.api.recommendation.service.SongRecommendationHomeService
import com.japanese.vocabulary.recommendation.dto.RecommendedSongDto
import com.japanese.vocabulary.recommendation.service.RecommendedSongService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`

class SongRecommendationHomeServiceTest {
    private val recommendedSongService = mock(RecommendedSongService::class.java)
    private val service = SongRecommendationHomeService(
        recommendedSongService = recommendedSongService,
    )

    @Test
    fun `returns empty list when there is no recommended song`() {
        `when`(recommendedSongService.list()).thenReturn(emptyList())

        assertThat(service.getRecommendations()).isEmpty()
    }

    @Test
    fun `maps recommended songs in list order`() {
        `when`(recommendedSongService.list()).thenReturn(
            listOf(
                RecommendedSongDto(
                    id = 1,
                    songId = 10,
                    title = "Ready",
                    artist = "Artist A",
                    artworkUrl = "https://example.com/a.jpg",
                    orderIndex = 0,
                    createdAt = null,
                ),
            )
        )

        val result = service.getRecommendations()

        assertThat(result).hasSize(1)
        assertThat(result.first().id).isEqualTo(1)
        assertThat(result.first().songId).isEqualTo(10)
        assertThat(result.first().title).isEqualTo("Ready")
        assertThat(result.first().artworkUrl).isEqualTo("https://example.com/a.jpg")
    }
}
