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
        try {
            val response = webClient.get()
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
                ?: throw LyricsNotFoundException("Could not find lyrics for: $artist - $title")

            // Prefer synced lyrics over plain lyrics
            val syncedLyrics = response.syncedLyrics
            if (!syncedLyrics.isNullOrBlank()) {
                return LyricsResult(
                    lrclibId = response.id,
                    lyrics = syncedLyrics,
                    isSynced = true
                )
            }

            val plainLyrics = response.plainLyrics
            if (!plainLyrics.isNullOrBlank()) {
                return LyricsResult(
                    lrclibId = response.id,
                    lyrics = plainLyrics,
                    isSynced = false
                )
            }

            throw LyricsNotFoundException("Lyrics are empty for: $artist - $title")
        } catch (e: WebClientResponseException.NotFound) {
            throw LyricsNotFoundException("Could not find lyrics for: $artist - $title")
        }
    }
}
