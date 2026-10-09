package com.japanese.vocabulary.lyricsearch

import com.japanese.vocabulary.common.text.ArtistNameNormalizer
import com.japanese.vocabulary.songsearch.client.applemusic.AppleMusicClient
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

/**
 * Answers whether a lyric provider's artist spelling names the artist we are searching for, when
 * the two cannot be compared directly — `Aimyon` on LrcLib against `あいみょん` from Apple Music.
 *
 * Asks the Apple Music JP catalog, which our queries come from and which resolves romanized spellings to the
 * canonical names. Searches the artist name alone; adding the title pulls in karaoke and music-box
 * covers. A failed lookup counts as "not the same artist" to avoid attaching a stranger's lyrics.
 */
@Component
class AppleMusicArtistAliasVerifier(
    private val appleMusicClient: AppleMusicClient,
) {
    private val logger = LoggerFactory.getLogger(AppleMusicArtistAliasVerifier::class.java)

    fun isSameArtist(queryArtistParts: List<String>, candidateArtist: String): Boolean {
        val wanted = queryArtistParts.map(ArtistNameNormalizer::normalize).filter { it.isNotEmpty() }
        if (wanted.isEmpty()) return false
        val catalogArtists = try {
            appleMusicClient.search(candidateArtist).items.map { it.artistName }
        } catch (e: Exception) {
            logger.warn("Apple Music artist alias lookup failed for '{}': {}", candidateArtist, e.message)
            return false
        }
        val matched = catalogArtists.any { artist ->
            val normalized = ArtistNameNormalizer.normalize(artist)
            wanted.any { normalized.contains(it) }
        }
        logger.info(
            "Artist alias check | candidate='{}' | query={} | catalogArtists={} | sameArtist={}",
            candidateArtist, queryArtistParts, catalogArtists.distinct().take(5), matched
        )
        return matched
    }
}
