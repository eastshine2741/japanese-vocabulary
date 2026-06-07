package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.song.cache.SongSearchCache
import com.japanese.vocabulary.song.client.itunes.ItunesClient
import com.japanese.vocabulary.song.dto.SongSearchResponse
import org.springframework.stereotype.Service
import java.text.Normalizer

/**
 * Wraps [ItunesClient] with a search-result cache (see [SongSearchCache]).
 *
 * iTunes Search API enforces ~20 calls/min/IP. The cache absorbs the burst of
 * duplicate queries that arrive within an hour — typically the same popular
 * songs queried by many users in a short window. On cache failure the cache
 * returns null and we fall through to a direct iTunes call so the search
 * endpoint never goes dark.
 */
@Service
class SongSearchService(
    private val itunesClient: ItunesClient,
    private val cache: SongSearchCache,
) {
    fun search(rawQuery: String): SongSearchResponse {
        val normalized = normalize(rawQuery)
        if (normalized.isBlank()) return SongSearchResponse(emptyList())

        cache.get(normalized)?.let { return it }

        val result = itunesClient.search(rawQuery)
        cache.put(normalized, result)
        return result
    }

    /**
     * Cache-key normalization. Only safe transforms — these unify whitespace and
     * unicode width but never alter the user's intended query semantically.
     * Kana/kanji are left untouched: katakana↔hiragana conversion yields a
     * different iTunes result and would surface as a wrong-search UX bug.
     */
    private fun normalize(q: String): String =
        Normalizer.normalize(q.trim(), Normalizer.Form.NFKC)
            .replace(WHITESPACE_RE, " ")
            .lowercase()

    companion object {
        private val WHITESPACE_RE = Regex("\\s+")
    }
}
