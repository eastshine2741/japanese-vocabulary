package com.japanese.vocabulary.lyricsearch.lrclib

import org.springframework.stereotype.Component
import com.japanese.vocabulary.common.retry.TransientHttpErrors
import com.japanese.vocabulary.lyricsearch.JapaneseLyricValidator
import com.japanese.vocabulary.lyricsearch.LanguageVersion
import com.japanese.vocabulary.common.text.ArtistNameNormalizer
import com.japanese.vocabulary.lyricsearch.AppleMusicArtistAliasVerifier
import com.japanese.vocabulary.lyricsearch.LyricProvider
import com.japanese.vocabulary.lyricsearch.LyricProviderRetry
import com.japanese.vocabulary.lyricsearch.LyricsResult
import com.japanese.vocabulary.lyricsearch.NormalizedSongQuery
import com.japanese.vocabulary.lyricsearch.lrclib.dto.LrclibResponse
import kotlinx.coroutines.CancellationException
import org.slf4j.LoggerFactory
import org.springframework.core.annotation.Order
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientResponseException
import java.text.Normalizer
import kotlin.math.abs

@Order(1)
@Component
class LrclibClient(
    restClientBuilder: RestClient.Builder,
    private val artistAliasVerifier: AppleMusicArtistAliasVerifier,
    private val retry: LyricProviderRetry,
) : LyricProvider {

    override val providerName = "LrcLib"

    private val logger = LoggerFactory.getLogger(LrclibClient::class.java)

    private val restClient = restClientBuilder.clone()
        .baseUrl("https://lrclib.net")
        .defaultHeader("User-Agent", "JapaneseVocabularyApp/1.0")
        .build()

    override suspend fun search(query: NormalizedSongQuery): LyricsResult? {
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
            // An outage that outlived the request retries is not a miss: it must not report "no lyrics".
            if (e is CancellationException || TransientHttpErrors.isTransient(e)) throw e
            logger.warn("LrcLib lyrics search failed for: ${query.originalArtist} - ${query.originalTitle}", e)
            null
        }
    }

    private suspend fun fetchFromGet(title: String, artist: String, durationSeconds: Int?): LyricsResult? {
        logger.info(
            "Lyric search attempt | provider=LrcLib | strategy=exact-match | title='{}' | artist='{}' | duration={}",
            title, artist, durationSeconds ?: "none"
        )
        val response = try {
            retry.call(providerName) {
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
            } ?: return null
        } catch (e: HttpClientErrorException.NotFound) {
            return null
        }

        if (LanguageVersion.of(response.trackName) != LanguageVersion.of(title)) {
            logger.info("Rejected other language version | provider=LrcLib | track='{}' | lrclibId={}", response.trackName, response.id)
            return null
        }
        return toResult(response)?.also {
            logger.info(
                "Lyric search hit | provider=LrcLib | strategy=exact-match | lrclibId={} | synced={}",
                it.lrclibId, it.isSynced
            )
        }
    }

    private suspend fun fetchFromSearch(query: NormalizedSongQuery): LyricsResult? {
        val titles = listOfNotNull(
            query.originalTitle,
            query.normalizedTitle.takeIf { it != query.originalTitle }
        )
        val normalizedParts = query.artistParts.map(ArtistNameNormalizer::normalize)

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
                pickMatch(scoped, query, normalizedParts, "artist-scoped")?.let { return it }
            }

            // 2차: q= 로 client-side 매칭
            //   cross-script 아티스트명(예: あいみょん vs Aimyon) 처럼 server-side artist_name 매칭이 못 잡는 케이스 대응
            logger.info(
                "Lyric search attempt | provider=LrcLib | strategy=keyword-search | mode=title-only | query='{}' | artistFilter={} | durationFilter={}",
                title, normalizedParts, query.durationSeconds ?: "none"
            )
            val results = searchRequest { it.path("/api/search").queryParam("q", title) } ?: continue
            pickMatch(results, query, normalizedParts, "title-only")?.let { return it }
        }

        return null
    }

    private suspend fun searchRequest(
        configure: (org.springframework.web.util.UriBuilder) -> org.springframework.web.util.UriBuilder,
    ): List<LrclibResponse>? {
        return try {
            retry.call(providerName) {
                restClient.get()
                    .uri { configure(it).build() }
                    .retrieve()
                    .body(Array<LrclibResponse>::class.java)
                    ?.toList()
            }
        } catch (e: RestClientResponseException) {
            if (TransientHttpErrors.isTransient(e)) throw e
            null
        }
    }

    private fun pickMatch(
        results: List<LrclibResponse>,
        query: NormalizedSongQuery,
        normalizedParts: List<String>,
        mode: String,
    ): LyricsResult? {
        // Tier 1: artist name match
        for (response in results) {
            val responseArtist = ArtistNameNormalizer.normalize(response.artistName)
            if (normalizedParts.any { responseArtist.contains(it) } && titleMatches(query, response.trackName)) {
                toResult(response)?.let {
                    logger.info(
                        "Lyric search hit | provider=LrcLib | strategy=keyword-search | mode={} | matchedBy=artist | responseArtist='{}' | lrclibId={} | synced={}",
                        mode, response.artistName, it.lrclibId, it.isSynced
                    )
                    return it
                }
            }
        }

        // Tier 2: duration match for cross-script artist names (あいみょん vs Aimyon). Duration alone is not
        // evidence (short titles like 『恋』 have many same-length songs), so the artist must also resolve via alias lookup.
        val durationSeconds = query.durationSeconds ?: return null
        val verifiedArtists = mutableMapOf<String, Boolean>()
        for (response in results) {
            val responseDuration = response.duration ?: continue
            if (abs(durationSeconds - responseDuration) > DURATION_TOLERANCE_SECONDS) continue
            if (!titleMatches(query, response.trackName)) continue
            val sameArtist = verifiedArtists.getOrPut(response.artistName) {
                artistAliasVerifier.isSameArtist(query.artistParts, response.artistName)
            }
            if (!sameArtist) {
                logger.info(
                    "Rejected duration-only candidate | provider=LrcLib | mode={} | responseArtist='{}' | responseDuration={} | lrclibId={}",
                    mode, response.artistName, responseDuration, response.id
                )
                continue
            }
            toResult(response)?.let {
                logger.info(
                    "Lyric search hit | provider=LrcLib | strategy=keyword-search | mode={} | matchedBy=duration+alias | responseArtist='{}' | responseDuration={} | lrclibId={} | synced={}",
                    mode, response.artistName, responseDuration, it.lrclibId, it.isSynced
                )
                return it
            }
        }

        return null
    }

    private fun toResult(response: LrclibResponse): LyricsResult? {
        val lyrics = (response.syncedLyrics?.takeIf { it.isNotBlank() }
            ?: response.plainLyrics?.takeIf { it.isNotBlank() }
            ?: return null)
            .let(::withoutAppendedTransliteration)

        if (!JapaneseLyricValidator.isJapaneseLyrics(lyrics)) {
            logger.info("Rejected non-Japanese lyrics | provider=LrcLib | lrclibId={}", response.id)
            return null
        }

        // Some uploads put the LRC text in plainLyrics; stored as PLAIN, the stamps would show in the lyric lines.
        val isSynced = response.syncedLyrics?.isNotBlank() == true || isTimestamped(lyrics)
        return LyricsResult(
            lrclibId = response.id,
            lyrics = lyrics,
            isSynced = isSynced,
        )
    }

    /**
     * Some uploads append a romaji copy whose stamps restart from the top (アイドル / YOASOBI). It halves the
     * kana-line ratio so the right upload fails the Japanese check, and stored as is it would repeat the song in romaji.
     */
    private fun withoutAppendedTransliteration(lyrics: String): String {
        val lines = lyrics.lines()
        var latest = -1.0
        for ((i, line) in lines.withIndex()) {
            val seconds = LRC_TIME_RE.find(line)?.destructured?.let { (m, s, f) -> m.toInt() * 60 + s.toInt() + "0.$f".toDouble() }
                ?: continue
            if (seconds < latest - RESTART_SECONDS) {
                val rest = lines.drop(i).filter { it.isNotBlank() }
                return if (rest.none { KANA_RE.containsMatchIn(it) }) lines.take(i).joinToString("\n") else lyrics
            }
            latest = maxOf(latest, seconds)
        }
        return lyrics
    }

    private fun isTimestamped(lyrics: String): Boolean {
        val lines = lyrics.lines().filter { it.isNotBlank() }
        return lines.isNotEmpty() && lines.count { LRC_LINE_RE.containsMatchIn(it) }.toDouble() / lines.size >= MIN_TIMESTAMPED_LINE_RATIO
    }

    /**
     * Search results list the artist's other songs too, so the title must match apart from feat/descriptor
     * spelling ("春日影 - MyGO!!!!! ver." vs "春日影 (MyGO!!!!! ver.)").
     */
    private fun titleMatches(query: NormalizedSongQuery, trackName: String): Boolean {
        val track = comparableTitle(trackName)
        return track.isNotEmpty() &&
            (track == comparableTitle(query.originalTitle) || track == comparableTitle(query.normalizedTitle)) &&
            LanguageVersion.of(trackName) == LanguageVersion.of(query.originalTitle)
    }

    private fun comparableTitle(title: String): String =
        Normalizer.normalize(title, Normalizer.Form.NFKC).lowercase()
            .replace(FEAT_RE, "")
            .replace(DESCRIPTOR_RE, "")
            .replace(NON_WORD_RE, "")

    private companion object {
        const val DURATION_TOLERANCE_SECONDS = 3
        const val MIN_TIMESTAMPED_LINE_RATIO = 0.5
        val LRC_LINE_RE = Regex("""^\s*\[\d{2,3}:\d{2}[.:]\d{2,3}]""")
        val LRC_TIME_RE = Regex("""^\s*\[(\d{2,3}):(\d{2})[.:](\d{2,3})]""")
        val KANA_RE = Regex("[぀-ゟ゠-ヿｦ-ﾟ]")
        const val RESTART_SECONDS = 30.0
        val FEAT_RE = Regex("""\s*[(\[（]?\s*(?<![a-z])(?:feat\.?|ft\.?|featuring)\s[^)\]）]*[)\]）]?""")
        // Bracketed or " - " suffix descriptors; version markers are compared separately by languageVersions.
        val DESCRIPTOR_RE = Regex("""\s*(?:[(\[（【][^)\]）】]*[)\]）】]|\s[-–—]\s.*$)""")
        val NON_WORD_RE = Regex("""[\p{P}\p{S}\s]+""")
    }
}
