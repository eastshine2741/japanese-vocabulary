package com.japanese.vocabulary.applemusicrss.client

import com.japanese.vocabulary.applemusicrss.client.dto.AppleMusicRssResponseDto
import com.japanese.vocabulary.applemusicrss.dto.AppleMusicRssChartSongDto
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient

@Component
class AppleMusicRssClient(restClientBuilder: RestClient.Builder) {
    private val logger = LoggerFactory.getLogger(AppleMusicRssClient::class.java)

    private val restClient = restClientBuilder.clone()
        .baseUrl("https://rss.marketingtools.apple.com")
        .build()

    fun fetchMostPlayedSongs(
        storefront: String = DEFAULT_STOREFRONT,
        limit: Int = DEFAULT_LIMIT,
    ): List<AppleMusicRssChartSongDto> {
        val response = restClient.get()
            .uri("/api/v2/{storefront}/music/most-played/{limit}/songs.json", storefront, limit)
            .retrieve()
            .body(AppleMusicRssResponseDto::class.java)
            ?: throw IllegalStateException("Apple Music RSS returned an empty response body")

        val results = response.feed.results.mapIndexed { index, song ->
            AppleMusicRssChartSongDto(
                rank = index + 1,
                id = song.id,
                name = song.name,
                artistName = song.artistName,
                artistId = song.artistId,
                artistUrl = song.artistUrl,
                artworkUrl100 = song.artworkUrl100,
                url = song.url,
                releaseDate = song.releaseDate,
                genres = song.genres,
            )
        }

        if (results.size != limit) {
            logger.warn(
                "Apple Music RSS returned unexpected result count: storefront={}, requestedLimit={}, actual={}",
                storefront,
                limit,
                results.size,
            )
        }

        return results
    }

    companion object {
        const val DEFAULT_STOREFRONT = "jp"
        const val DEFAULT_LIMIT = 100
    }
}
