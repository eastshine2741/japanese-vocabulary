package com.japanese.vocabulary.lyricsearch

import com.japanese.vocabulary.songsearch.client.itunes.ItunesClient
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

/**
 * Answers whether a lyric provider's artist spelling names the artist we are searching for, when
 * the two cannot be compared directly — `Aimyon` on LrcLib against `あいみょん` from iTunes.
 *
 * Asks iTunes JP, the catalog our queries come from: it resolves `Aimyon`, `Kenshi Yonezu`, even
 * the mistyped `Official鬍子男dism` to the canonical names our queries carry, while `Conton Candy`
 * stays `Conton Candy`. Searching the artist name alone keeps the answer clean — `Aimyon` returns
 * あいみょん on 58 of 60 tracks, whereas adding the title pulls in karaoke and music-box covers.
 * A lookup that fails counts as "not the same artist", since the alternative is attaching a
 * stranger's lyrics.
 */
@Component
class ItunesArtistAliasVerifier(
    private val itunesClient: ItunesClient,
) {
    private val logger = LoggerFactory.getLogger(ItunesArtistAliasVerifier::class.java)

    fun isSameArtist(queryArtistParts: List<String>, candidateArtist: String): Boolean {
        val wanted = queryArtistParts.map(ArtistNameNormalizer::normalize).filter { it.isNotEmpty() }
        if (wanted.isEmpty()) return false
        val catalogArtists = try {
            itunesClient.search(candidateArtist).items.map { it.artistName }
        } catch (e: Exception) {
            logger.warn("iTunes artist alias lookup failed for '{}': {}", candidateArtist, e.message)
            return false
        }
        val matched = catalogArtists.any { artist ->
            val normalized = ArtistNameNormalizer.normalize(artist)
            wanted.any { normalized.contains(it) }
        }
        logger.info(
            "Artist alias check | candidate='{}' | query={} | itunesArtists={} | sameArtist={}",
            candidateArtist, queryArtistParts, catalogArtists.distinct().take(5), matched
        )
        return matched
    }
}
