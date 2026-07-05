package com.japanese.vocabulary.lyricsearch.lrclib

import org.springframework.stereotype.Component
import com.japanese.vocabulary.lyricsearch.JapaneseLyricValidator
import com.japanese.vocabulary.lyricsearch.LyricProvider
import com.japanese.vocabulary.lyricsearch.LyricsResult
import com.japanese.vocabulary.lyricsearch.NormalizedSongQuery
import com.japanese.vocabulary.lyricsearch.lrclib.dto.LrclibResponse
import org.slf4j.LoggerFactory
import org.springframework.core.annotation.Order
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientResponseException
import kotlin.math.abs

@Order(1)
@Component
class LrclibClient(restClientBuilder: RestClient.Builder) : LyricProvider {

    override val providerName = "LrcLib"

    private val logger = LoggerFactory.getLogger(LrclibClient::class.java)

    private val restClient = restClientBuilder.clone()
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
        logger.info(
            "Lyric search attempt | provider=LrcLib | strategy=exact-match | title='{}' | artist='{}' | duration={}",
            title, artist, durationSeconds ?: "none"
        )
        val response = try {
            restClient.get()
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
                .body(LrclibResponse::class.java)
                ?: return null
        } catch (e: RestClientResponseException) {
            return null
        }

        return toResult(response)?.also {
            logger.info(
                "Lyric search hit | provider=LrcLib | strategy=exact-match | lrclibId={} | synced={}",
                it.lrclibId, it.isSynced
            )
        }
    }

    private fun fetchFromSearch(query: NormalizedSongQuery): LyricsResult? {
        val titles = listOfNotNull(
            query.originalTitle,
            query.normalizedTitle.takeIf { it != query.originalTitle }
        )
        val normalizedParts = query.artistParts.map { it.lowercase() }

        for (title in titles) {
            // 1차: track_name + artist_name 으로 server-side 필터
            //   영어권 동명이곡이 많은 제목(예: Lemon)에서 일본 아티스트가 top-N 응답에 안 잡히는 케이스 대응
            for (artistPart in query.artistParts) {
                logger.info(
                    "Lyric search attempt | provider=LrcLib | strategy=keyword-search | mode=artist-scoped | track='{}' | artist='{}'",
                    title, artistPart
                )
                val scoped = searchRequest { uri ->
                    uri.path("/api/search")
                        .queryParam("track_name", title)
                        .queryParam("artist_name", artistPart)
                } ?: continue
                pickMatch(scoped, normalizedParts, query.durationSeconds, "artist-scoped")?.let { return it }
            }

            // 2차: q= 로 client-side 매칭
            //   cross-script 아티스트명(예: あいみょん vs Aimyon) 처럼 server-side artist_name 매칭이 못 잡는 케이스 대응
            logger.info(
                "Lyric search attempt | provider=LrcLib | strategy=keyword-search | mode=title-only | query='{}' | artistFilter={} | durationFilter={}",
                title, normalizedParts, query.durationSeconds ?: "none"
            )
            val results = searchRequest { it.path("/api/search").queryParam("q", title) } ?: continue
            pickMatch(results, normalizedParts, query.durationSeconds, "title-only")?.let { return it }
        }

        return null
    }

    private fun searchRequest(
        configure: (org.springframework.web.util.UriBuilder) -> org.springframework.web.util.UriBuilder,
    ): List<LrclibResponse>? {
        return try {
            restClient.get()
                .uri { configure(it).build() }
                .retrieve()
                .body(Array<LrclibResponse>::class.java)
                ?.toList()
        } catch (e: RestClientResponseException) {
            null
        }
    }

    private fun pickMatch(
        results: List<LrclibResponse>,
        normalizedParts: List<String>,
        durationSeconds: Int?,
        mode: String,
    ): LyricsResult? {
        // Tier 1: artist name match
        for (response in results) {
            val responseArtist = response.artistName.lowercase()
            if (normalizedParts.any { responseArtist.contains(it) }) {
                toResult(response)?.let {
                    logger.info(
                        "Lyric search hit | provider=LrcLib | strategy=keyword-search | mode={} | matchedBy=artist | responseArtist='{}' | lrclibId={} | synced={}",
                        mode, response.artistName, it.lrclibId, it.isSynced
                    )
                    return it
                }
            }
        }

        // Tier 2: duration match (handles cross-script artist names like あいみょん vs Aimyon)
        if (durationSeconds != null) {
            for (response in results) {
                val responseDuration = response.duration
                if (responseDuration != null && abs(durationSeconds - responseDuration) <= 3) {
                    toResult(response)?.let {
                        logger.info(
                            "Lyric search hit | provider=LrcLib | strategy=keyword-search | mode={} | matchedBy=duration | responseDuration={} | lrclibId={} | synced={}",
                            mode, responseDuration, it.lrclibId, it.isSynced
                        )
                        return it
                    }
                }
            }
        }

        return null
    }

    private fun toResult(response: LrclibResponse): LyricsResult? {
        val lyrics = response.syncedLyrics?.takeIf { it.isNotBlank() }
            ?: response.plainLyrics?.takeIf { it.isNotBlank() }
            ?: return null

        if (!JapaneseLyricValidator.isJapaneseLyrics(lyrics)) {
            logger.info("Rejected non-Japanese lyrics | provider=LrcLib | lrclibId={}", response.id)
            return null
        }

        val isSynced = response.syncedLyrics?.isNotBlank() == true
        return LyricsResult(lrclibId = response.id, lyrics = if (isSynced) response.syncedLyrics!! else lyrics, isSynced = isSynced)
    }
}
