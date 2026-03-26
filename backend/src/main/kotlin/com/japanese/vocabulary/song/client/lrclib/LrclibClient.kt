package com.japanese.vocabulary.song.client.lrclib

import com.japanese.vocabulary.song.client.LyricsNotFoundException
import com.japanese.vocabulary.song.client.LyricsResult
import com.japanese.vocabulary.song.client.lrclib.dto.LrclibResponse
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.WebClientResponseException

@Component
class LrclibClient {

    private val webClient = WebClient.builder()
        .baseUrl("https://lrclib.net")
        .defaultHeader("User-Agent", "JapaneseVocabularyApp/1.0")
        .build()

    // TODO: filter only japanese lyrics
    fun getLyrics(title: String, artist: String, durationSeconds: Int?): LyricsResult {
        // 1차: 제목 + 가수명으로 exact match
        fetchFromGet(title, artist, durationSeconds)?.let { return it }

        // 2차: 제목만으로 search fallback
        fetchFromSearch(title)?.let { return it }

        throw LyricsNotFoundException("Could not find lyrics for: $artist - $title")
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

    private fun fetchFromSearch(title: String): LyricsResult? {
        val results = try {
            webClient.get()
                .uri { it.path("/api/search").queryParam("q", title).build() }
                .retrieve()
                .bodyToFlux(LrclibResponse::class.java)
                .collectList()
                .block()
                ?: return null
        } catch (e: WebClientResponseException) {
            return null
        }

        return results.firstNotNullOfOrNull { toResult(it) }
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
