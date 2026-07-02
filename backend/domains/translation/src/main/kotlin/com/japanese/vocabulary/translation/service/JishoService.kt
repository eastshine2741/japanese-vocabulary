package com.japanese.vocabulary.translation.service

import com.japanese.vocabulary.translation.client.jisho.JishoClient
import com.japanese.vocabulary.translation.client.jisho.cache.JishoCache
import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import org.springframework.stereotype.Service

/**
 * Cache-aside orchestration over [JishoClient]: serves jisho lookups from [JishoCache] first and
 * fetches misses under a global concurrency limit. The [JishoClient] only talks to the API.
 *
 * - **Bounded concurrency**: a process-global [Semaphore] caps concurrent outbound requests at
 *   [MAX_CONCURRENCY]; 3 stays under jisho's rate limit (6 was observed to trigger HTTP 429).
 * - **Never cache failures**: a fetch error yields a not-found result that is NOT cached, so it
 *   retries on the next run. Successful fetches (found or genuine not-found) are cached.
 */
@Service
class JishoService(
    private val jishoClient: JishoClient,
    private val jishoCache: JishoCache,
) {
    private val semaphore = Semaphore(MAX_CONCURRENCY)

    /**
     * Look up many dictionary forms. Cache-first; uncached forms are fetched under the global
     * concurrency limit. Successful fetches (including genuine not-found) are cached; errors are not.
     */
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
