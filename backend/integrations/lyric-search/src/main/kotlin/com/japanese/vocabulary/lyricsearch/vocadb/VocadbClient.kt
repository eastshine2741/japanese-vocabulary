package com.japanese.vocabulary.lyricsearch.vocadb

import org.springframework.stereotype.Component
import com.japanese.vocabulary.lyricsearch.LyricProvider
import com.japanese.vocabulary.lyricsearch.LyricsResult
import com.japanese.vocabulary.lyricsearch.NormalizedSongQuery
import com.japanese.vocabulary.lyricsearch.vocadb.dto.VocadbArtistSearchResponse
import com.japanese.vocabulary.lyricsearch.vocadb.dto.VocadbSearchResponse
import com.japanese.vocabulary.lyricsearch.vocadb.dto.VocadbSongDto
import org.slf4j.LoggerFactory
import org.springframework.core.annotation.Order
import org.springframework.web.client.RestClient
import org.springframework.web.util.UriBuilder

@Order(2)
@Component
class VocadbClient(restClientBuilder: RestClient.Builder) : LyricProvider {

    override val providerName = "VocaDB"

    private val logger = LoggerFactory.getLogger(VocadbClient::class.java)

    private val restClient = restClientBuilder.clone()
        .baseUrl("https://vocadb.net")
        .defaultHeader("User-Agent", "JapaneseVocabularyApp/1.0")
        .build()

    /**
     * VocaDB has no artist-name filter on song search, so a short title like 『恋』 buries the
     * wanted song under thousands of prefix matches sorted by popularity. Resolving the artist id
     * first and passing `artistId[]` is the only server-side artist filter; the plain keyword
     * search stays as a fallback for artists VocaDB does not list.
     */
    override fun search(query: NormalizedSongQuery): LyricsResult? {
        return try {
            val artistIds = resolveArtistIds(query.artistParts)
            if (artistIds.isNotEmpty()) {
                searchWithinArtists(query, artistIds)?.let { return it }
            }
            searchByKeyword(query)
        } catch (e: Exception) {
            logger.warn("VocaDB lyrics search failed for: ${query.originalArtist} - ${query.originalTitle}", e)
            null
        }
    }

    private fun resolveArtistIds(artistParts: List<String>): List<Long> {
        return artistParts.flatMap { part ->
            val response = restClient.get()
                .uri { uriBuilder ->
                    uriBuilder.path("/api/artists")
                        .queryParam("query", part)
                        .queryParam("fields", "Names")
                        .queryParam("maxResults", 5)
                        .queryParam("nameMatchMode", "Auto")
                        .build()
                }
                .retrieve()
                .body(VocadbArtistSearchResponse::class.java)
                ?: return@flatMap emptyList()

            response.items
                .filter { VocadbSongMatcher.isSameArtist(part, it) }
                .map { it.id }
        }.distinct()
    }

    private fun searchWithinArtists(query: NormalizedSongQuery, artistIds: List<Long>): LyricsResult? {
        logger.info(
            "Lyric search attempt | provider=VocaDB | strategy=artist-scoped | query='{}' | artistIds={}",
            query.normalizedTitle, artistIds
        )
        val response = restClient.get()
            .uri { uriBuilder ->
                songSearchUri(uriBuilder, query.normalizedTitle)
                    .apply { artistIds.forEach { queryParam("artistId[]", it) } }
                    .build()
            }
            .retrieve()
            .body(VocadbSearchResponse::class.java)
            ?: return null

        return firstWithLyrics(response.items) { VocadbSongMatcher.matchesWithinArtist(query, it) }
    }

    private fun searchByKeyword(query: NormalizedSongQuery): LyricsResult? {
        logger.info(
            "Lyric search attempt | provider=VocaDB | strategy=keyword-search | query='{}' | artistFilter={}",
            query.normalizedTitle, query.artistParts
        )
        val response = restClient.get()
            .uri { uriBuilder -> songSearchUri(uriBuilder, query.normalizedTitle).build() }
            .retrieve()
            .body(VocadbSearchResponse::class.java)
            ?: return null

        return firstWithLyrics(response.items) { VocadbSongMatcher.matches(query, it) }
    }

    private fun songSearchUri(uriBuilder: UriBuilder, title: String): UriBuilder =
        uriBuilder.path("/api/songs")
            .queryParam("query", title)
            .queryParam("fields", "Lyrics,Artists,Names,PVs,WebLinks")
            .queryParam("maxResults", 10)
            .queryParam("sort", "FavoritedTimes")
            .queryParam("songTypes", "Original")
            .queryParam("nameMatchMode", "Auto")

    private fun firstWithLyrics(songs: List<VocadbSongDto>, accepts: (VocadbSongDto) -> Boolean): LyricsResult? {
        for (song in songs) {
            if (!accepts(song)) continue

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
                isSynced = false,
            )
        }
        return null
    }
}
