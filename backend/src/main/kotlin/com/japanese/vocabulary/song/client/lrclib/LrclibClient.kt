package com.japanese.vocabulary.song.client.lrclib

import com.japanese.vocabulary.song.client.LyricProvider
import com.japanese.vocabulary.song.client.LyricsResult
import com.japanese.vocabulary.song.client.NormalizedSongQuery
import com.japanese.vocabulary.song.client.lrclib.dto.LrclibResponse
import org.slf4j.LoggerFactory
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.WebClientResponseException
import kotlin.math.abs

@Component
@Order(1)
class LrclibClient : LyricProvider {

    override val providerName = "LrcLib"

    private val logger = LoggerFactory.getLogger(LrclibClient::class.java)

    private val webClient = WebClient.builder()
        .baseUrl("https://lrclib.net")
        .defaultHeader("User-Agent", "JapaneseVocabularyApp/1.0")
        .build()

    override fun search(query: NormalizedSongQuery): LyricsResult? {
        return try {
            // 1차: exact match (원본 → 정규화된 아티스트 파트별)
            fetchFromGet(query.originalTitle, query.originalArtist, query.durationSeconds)
                ?.let { return it }

            if (query.normalizedTitle != query.originalTitle || query.artistParts.size > 1) {
                for (artistPart in query.artistParts) {
                    fetchFromGet(query.normalizedTitle, artistPart, query.durationSeconds)
                        ?.let { return it }
                }
            }

            // 2차: search (아티스트 매칭 → duration 매칭 순으로 필터)
            fetchFromSearch(query)?.let { return it }

            null
        } catch (e: Exception) {
            logger.warn("LrcLib lyrics search failed for: ${query.originalArtist} - ${query.originalTitle}", e)
            null
        }
    }

    private fun fetchFromGet(title: String, artist: String, durationSeconds: Int?): LyricsResult? {
        val response = try {
            webClient.get()
                .uri { uriBuilder ->
                    uriBuilder.path("/api/get")
                        .queryParam("track_name", title)
                        .queryParam("artist_name", artist)
                        .apply {
                            durationSeconds?.let { queryParam("duration", it) }
                        }
                        .build()
                }
                .retrieve()
                .bodyToMono(LrclibResponse::class.java)
                .block()
                ?: return null
        } catch (e: WebClientResponseException.NotFound) {
            return null
        }

        return toResult(response)
    }

    private fun fetchFromSearch(query: NormalizedSongQuery): LyricsResult? {
        val titles = listOfNotNull(
            query.originalTitle,
            query.normalizedTitle.takeIf { it != query.originalTitle }
        )
        val normalizedParts = query.artistParts.map { it.lowercase() }

        for (title in titles) {
            val results = try {
                webClient.get()
                    .uri { it.path("/api/search").queryParam("q", title).build() }
                    .retrieve()
                    .bodyToFlux(LrclibResponse::class.java)
                    .collectList()
                    .block() ?: continue
            } catch (e: WebClientResponseException) {
                continue
            }

            // Tier 1: artist name match
            for (response in results) {
                val responseArtist = response.artistName.lowercase()
                if (normalizedParts.any { responseArtist.contains(it) }) {
                    toResult(response)?.let { return it }
                }
            }

            // Tier 2: duration match (handles cross-script artist names like あいみょん vs Aimyon)
            if (query.durationSeconds != null) {
                for (response in results) {
                    val responseDuration = response.duration
                    if (responseDuration != null && abs(query.durationSeconds - responseDuration) <= 3) {
                        toResult(response)?.let { return it }
                    }
                }
            }
        }

        return null
    }

    private fun toResult(response: LrclibResponse): LyricsResult? {
        val syncedLyrics = response.syncedLyrics
        if (!syncedLyrics.isNullOrBlank()) {
            return LyricsResult(lrclibId = response.id, lyrics = syncedLyrics, isSynced = true)
        }

        val plainLyrics = response.plainLyrics
        if (!plainLyrics.isNullOrBlank()) {
            return LyricsResult(lrclibId = response.id, lyrics = plainLyrics, isSynced = false)
        }

        return null
    }
}
