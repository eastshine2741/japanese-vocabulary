package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.song.cache.SongSearchCache
import com.japanese.vocabulary.songsearch.client.applemusic.AppleMusicClient
import com.japanese.vocabulary.songsearch.dto.SongSearchResponse
import org.springframework.stereotype.Service
import java.text.Normalizer

/**
 * Wraps [AppleMusicClient] with a search-result cache (see [SongSearchCache]).
 *
 * Every user's search shares one developer token whose rate limit Apple does not publish, so the
 * cache absorbs repeated queries for popular songs within an hour. On cache failure the cache
 * returns null and we fall through to a direct Apple Music call so the search endpoint never goes dark.
 */
@Service
class SongSearchService(
    private val appleMusicClient: AppleMusicClient,
    private val cache: SongSearchCache,
) {
    fun search(rawQuery: String): SongSearchResponse {
        val normalized = normalize(rawQuery)
        if (normalized.isBlank()) return SongSearchResponse(emptyList())

        cache.get(normalized)?.let { return it }

        val result = appleMusicClient.search(rawQuery)
        cache.put(normalized, result)
        return result
    }

    /**
     * Cache-key normalization. Only safe transforms — these unify whitespace and
     * unicode width but never alter the user's intended query semantically.
     * Kana/kanji are left untouched: katakana↔hiragana conversion yields a
     * different catalog result and would surface as a wrong-search UX bug.
     */
    private fun normalize(q: String): String =
        Normalizer.normalize(q.trim(), Normalizer.Form.NFKC)
            .replace(WHITESPACE_RE, " ")
            .lowercase()

    companion object {
        private val WHITESPACE_RE = Regex("\\s+")
    }
}
