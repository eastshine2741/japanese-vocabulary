package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.song.cache.SongSearchCache
import com.japanese.vocabulary.songsearch.client.itunes.ItunesClient
import com.japanese.vocabulary.songsearch.dto.SongSearchResponse
import org.springframework.stereotype.Service
import java.text.Normalizer

/**
 * Wraps [ItunesClient] with a search-result cache (see [SongSearchCache]).
 * iTunes enforces ~20 calls/min/IP; on cache failure the cache returns null and we call iTunes directly.
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
     * Cache-key normalization: whitespace and unicode width only.
     * Kana/kanji stay untouched because katakana↔hiragana changes the iTunes result.
     */
    private fun normalize(q: String): String =
        Normalizer.normalize(q.trim(), Normalizer.Form.NFKC)
            .replace(WHITESPACE_RE, " ")
            .lowercase()

    companion object {
        private val WHITESPACE_RE = Regex("\\s+")
    }
}
