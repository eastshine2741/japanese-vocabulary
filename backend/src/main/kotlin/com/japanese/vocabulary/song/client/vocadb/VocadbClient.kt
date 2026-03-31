package com.japanese.vocabulary.song.client.vocadb

import com.japanese.vocabulary.song.client.LyricProvider
import com.japanese.vocabulary.song.client.LyricsResult
import com.japanese.vocabulary.song.client.NormalizedSongQuery
import com.japanese.vocabulary.song.client.vocadb.dto.VocadbSearchResponse
import org.slf4j.LoggerFactory
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient

@Component
@Order(2)
class VocadbClient : LyricProvider {

    override val providerName = "VocaDB"

    private val logger = LoggerFactory.getLogger(VocadbClient::class.java)

    private val webClient = WebClient.builder()
        .baseUrl("https://vocadb.net")
        .defaultHeader("User-Agent", "JapaneseVocabularyApp/1.0")
        .build()

    override fun search(query: NormalizedSongQuery): LyricsResult? {
        return try {
            val response = webClient.get()
                .uri { uriBuilder ->
                    uriBuilder.path("/api/songs")
                        .queryParam("query", query.normalizedTitle)
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

            val normalizedParts = query.artistParts.map { it.lowercase() }

            for (song in response.items) {
                val songArtist = song.artistString.lowercase()
                val artistMatches = normalizedParts.any { part -> songArtist.contains(part) }
                if (!artistMatches) continue

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
            logger.warn("VocaDB lyrics search failed for: ${query.originalArtist} - ${query.originalTitle}", e)
            null
        }
    }
}
