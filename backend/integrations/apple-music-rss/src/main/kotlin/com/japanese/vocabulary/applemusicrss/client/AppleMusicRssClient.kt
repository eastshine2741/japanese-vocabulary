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
                artworkUrl = upsizeArtwork(song.artworkUrl100),
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

    // Same rule as ItunesClient.upsizeArtwork: the mzstatic URL templates the size in the path,
    // and the RSS feed only ever hands out the 100x100 variant, which is blurry on the home
    // recommendation cards (roughly half the screen width).
    private fun upsizeArtwork(url: String?): String? = url?.let {
        when {
            it.endsWith("/100x100bb.jpg") -> it.replace("/100x100bb.jpg", "/600x600bb.jpg")
            it.endsWith("/100x100bb.png") -> it.replace("/100x100bb.png", "/600x600bb.png")
            else -> it
        }
    }

    companion object {
        const val DEFAULT_STOREFRONT = "jp"
        const val DEFAULT_LIMIT = 100
    }
}
