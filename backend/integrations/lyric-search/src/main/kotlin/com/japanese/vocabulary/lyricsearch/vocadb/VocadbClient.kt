package com.japanese.vocabulary.lyricsearch.vocadb

import org.springframework.stereotype.Component
import com.japanese.vocabulary.lyricsearch.LyricProvider
import com.japanese.vocabulary.lyricsearch.LyricsResult
import com.japanese.vocabulary.lyricsearch.NormalizedSongQuery
import com.japanese.vocabulary.lyricsearch.vocadb.dto.VocadbSearchResponse
import org.slf4j.LoggerFactory
import org.springframework.core.annotation.Order
import org.springframework.web.client.RestClient

@Order(2)
@Component
class VocadbClient(restClientBuilder: RestClient.Builder) : LyricProvider {

    override val providerName = "VocaDB"

    private val logger = LoggerFactory.getLogger(VocadbClient::class.java)

    private val restClient = restClientBuilder.clone()
        .baseUrl("https://vocadb.net")
        .defaultHeader("User-Agent", "JapaneseVocabularyApp/1.0")
        .build()

    override fun search(query: NormalizedSongQuery): LyricsResult? {
        return try {
            logger.info(
                "Lyric search attempt | provider=VocaDB | strategy=keyword-search | query='{}' | artistFilter={}",
                query.normalizedTitle, query.artistParts
            )
            val response = restClient.get()
                .uri { uriBuilder ->
                    uriBuilder.path("/api/songs")
                        .queryParam("query", query.normalizedTitle)
                        .queryParam("fields", "Lyrics,Artists,Names,PVs,WebLinks")
                        .queryParam("maxResults", 10)
                        .queryParam("sort", "FavoritedTimes")
                        .queryParam("songTypes", "Original")
                        .queryParam("nameMatchMode", "Auto")
                        .build()
                }
                .retrieve()
                .body(VocadbSearchResponse::class.java)
                ?: return null

            for (song in response.items) {
                if (!VocadbSongMatcher.matches(query, song)) continue

                val lyrics = song.lyrics?.firstOrNull { lyric ->
                    lyric.translationType == "Original" &&
                        lyric.cultureCodes.contains("ja") &&
                        !lyric.value.isNullOrBlank()
                } ?: continue

                logger.info(
                    "Lyric search hit | provider=VocaDB | matchedSong='{}' | matchedArtist='{}' | vocadbId={}",
                    song.name, song.artistString, song.id
                )
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
