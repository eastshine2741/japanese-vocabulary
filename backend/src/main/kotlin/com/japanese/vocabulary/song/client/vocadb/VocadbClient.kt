package com.japanese.vocabulary.song.client.vocadb

import com.japanese.vocabulary.song.client.LyricsResult
import com.japanese.vocabulary.song.client.vocadb.dto.VocadbSearchResponse
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient

@Component
class VocadbClient {

    private val logger = LoggerFactory.getLogger(VocadbClient::class.java)

    private val webClient = WebClient.builder()
        .baseUrl("https://vocadb.net")
        .defaultHeader("User-Agent", "JapaneseVocabularyApp/1.0")
        .build()

    fun searchLyrics(title: String, artist: String): LyricsResult? {
        return try {
            val response = webClient.get()
                .uri { uriBuilder ->
                    uriBuilder.path("/api/songs")
                        .queryParam("query", title)
                        .queryParam("fields", "Lyrics")
                        .queryParam("maxResults", 10)
                        .queryParam("sort", "FavoritedTimes")
                        .queryParam("songTypes", "Original")
                        .queryParam("nameMatchMode", "Auto")
                        .build()
                }
                .retrieve()
                .bodyToMono(VocadbSearchResponse::class.java)
                .block()
                ?: return null

            val normalizedArtist = artist.lowercase()
            for (song in response.items) {
                if (!song.artistString.lowercase().contains(normalizedArtist)) continue

                val lyrics = song.lyrics?.firstOrNull { lyric ->
                    lyric.translationType == "Original" &&
                        lyric.cultureCodes.contains("ja") &&
                        !lyric.value.isNullOrBlank()
                } ?: continue

                return LyricsResult(
                    vocadbId = song.id,
                    lyrics = lyrics.value!!,
                    isSynced = false
                )
            }

            null
        } catch (e: Exception) {
            logger.warn("VocaDB lyrics search failed for: $artist - $title", e)
            null
        }
    }
}
