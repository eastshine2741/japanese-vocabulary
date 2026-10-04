package com.japanese.vocabulary.translation.service

import org.springframework.stereotype.Service
import com.japanese.vocabulary.translation.client.jisho.JishoClient
import com.japanese.vocabulary.translation.client.jisho.cache.JishoCache
import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit

/**
 * Cache-aside over [JishoClient]: [JishoCache] first, misses fetched under a global concurrency limit.
 *
 * - A process-global [Semaphore] caps outbound requests at [MAX_CONCURRENCY]; 6 triggered HTTP 429.
 * - A fetch error yields a not-found result that is NOT cached. Successful fetches (found or
 *   genuine not-found) are cached.
 */
@Service
class JishoService(
    private val jishoClient: JishoClient,
    private val jishoCache: JishoCache,
) {
    private val semaphore = Semaphore(MAX_CONCURRENCY)

    suspend fun lookupAll(words: List<String>): Map<String, JishoEntryDto> = coroutineScope {
        words.distinct()
            .map { word -> async { word to lookup(word) } }
            .awaitAll()
            .toMap()
    }

    suspend fun lookup(word: String): JishoEntryDto {
        jishoCache.get(word)?.let { return it }
        val fetched = semaphore.withPermit { jishoClient.fetch(word) }
        if (fetched != null) {
            jishoCache.put(word, fetched) // cache 200 results (found or genuine not-found) only
            return fetched
        }
        return NOT_FOUND // error path: do not cache, retries next run
    }

    private companion object {
        const val MAX_CONCURRENCY = 3
        val NOT_FOUND = JishoEntryDto(found = false, provenance = JishoLookupProvenance.FETCH_ERROR)
    }
}
