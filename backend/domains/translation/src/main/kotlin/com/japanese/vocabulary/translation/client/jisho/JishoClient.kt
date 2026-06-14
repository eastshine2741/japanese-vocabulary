package com.japanese.vocabulary.translation.client.jisho

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.cache.Cache
import com.japanese.vocabulary.cache.RedisCache
import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryRawDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoOptionDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoSearchResponse
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import org.slf4j.LoggerFactory
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientResponseException
import java.time.Duration

/**
 * jisho.org dictionary client used to ground word-meaning generation (EN senses + POS + JLPT).
 *
 * Faithful port of the playground `common.py` jisho_full stage:
 * - **Flatten all senses**: every sense of every exact-match entry (`japanese.word`/`reading` == query)
 *   becomes one [JishoOptionDto] carrying its own reading/POS/EN gloss/JLPT. The sense-select LLM
 *   chooses one option per word downstream.
 * - **Fuzzy fallback**: if NO entry exactly matches (the query is an inflected/script variant, e.g.
 *   巡り会い→巡り会う, くり返す→繰り返す, ズルい→狡い), fall back to jisho's TOP entry — jisho deinflects
 *   the query and ranks the lemma first. The sense-select LLM still filters bad candidates to senseId=-1.
 * - **Shared cache**: results are cached in Redis (key `jisho:{word}`) so repeated forms across songs
 *   cost no network calls. Cache read/write errors are swallowed (degrade to a live fetch).
 * - **Bounded concurrency**: a process-global [Semaphore] caps concurrent outbound requests at
 *   [MAX_CONCURRENCY]; 3 stays under jisho's rate limit (6 was observed to trigger HTTP 429).
 * - **429 backoff**: retries with increasing delay.
 * - **Never cache failures**: an unrecovered network/HTTP error yields a not-found result that is
 *   NOT cached, so it retries on the next run.
 */
@Component
class JishoClient(
    restClientBuilder: RestClient.Builder,
    redisTemplate: StringRedisTemplate,
    objectMapper: ObjectMapper,
) {
    private val logger = LoggerFactory.getLogger(JishoClient::class.java)

    private val restClient = restClientBuilder
        .baseUrl("https://jisho.org")
        .defaultHeader("User-Agent", "JapaneseVocabularyApp/1.0")
        .build()

    private val cache: Cache<JishoEntryDto> =
        RedisCache(redisTemplate, objectMapper, JishoEntryDto::class.java)

    private val semaphore = Semaphore(MAX_CONCURRENCY)

    /**
     * Look up many dictionary forms. Cache-first; uncached forms are fetched under the global
     * concurrency limit. Successful fetches (including genuine not-found) are cached; errors are not.
     */
    suspend fun lookupAll(words: List<String>): Map<String, JishoEntryDto> = coroutineScope {
        val uniq = words.distinct()
        uniq.map { word -> async { word to lookup(word) } }
            .awaitAll()
            .toMap()
    }

    suspend fun lookup(word: String): JishoEntryDto {
        cacheGet(word)?.let { return it }
        val fetched = semaphore.withPermit { fetchOrNull(word) }
        if (fetched != null) {
            cachePut(word, fetched) // cache 200 results (found or genuine not-found) only
            return fetched
        }
        return NOT_FOUND // error path: do not cache, retries next run
    }

    /**
     * Pure network fetch. Returns the distilled entry on HTTP 200 (found or genuine not-found),
     * or null on an unrecovered error (so the caller skips caching). Mirrors `_jisho_fetch`.
     */
    private suspend fun fetchOrNull(word: String): JishoEntryDto? {
        repeat(MAX_ATTEMPTS) { attempt ->
            try {
                val response = withContext(Dispatchers.IO) {
                    restClient.get()
                        .uri { it.path("/api/v1/search/words").queryParam("keyword", word).build() }
                        .retrieve()
                        .body(JishoSearchResponse::class.java)
                } ?: JishoSearchResponse()
                return distill(word, response)
            } catch (e: RestClientResponseException) {
                if (e.statusCode.value() == 429 && attempt < MAX_ATTEMPTS - 1) {
                    delay((1500L * (attempt + 1)))
                } else {
                    logger.warn("jisho lookup failed for '{}': HTTP {}", word, e.statusCode.value())
                    return null
                }
            } catch (e: Exception) {
                logger.warn("jisho lookup failed for '{}': {}", word, e.javaClass.simpleName)
                return null
            }
        }
        return null
    }

    /**
     * Flatten exact-match entries' senses into options; if none match, fall back to jisho's top entry.
     * Mirrors `_jisho_full_fetch`'s match policy + `_flatten_entry`.
     */
    private fun distill(word: String, response: JishoSearchResponse): JishoEntryDto {
        val options = response.data
            .filter { entry -> entry.japanese.any { it.word == word || it.reading == word } }
            .flatMap { flattenEntry(it) }
            .ifEmpty { response.data.firstOrNull()?.let { flattenEntry(it) } ?: emptyList() }
        return JishoEntryDto(found = options.isNotEmpty(), word = word, options = options)
    }

    /** One jisho entry → one [JishoOptionDto] per sense. Mirrors `_flatten_entry`. */
    private fun flattenEntry(entry: JishoEntryRawDto): List<JishoOptionDto> {
        val first = entry.japanese.firstOrNull()
        val reading = first?.reading ?: first?.word
        val options = mutableListOf<JishoOptionDto>()
        var carryPos: List<String> = emptyList() // jisho repeats POS only when it changes; carry forward
        for (sense in entry.senses) {
            if (sense.englishDefinitions.isEmpty()) continue
            val pos = sense.partsOfSpeech.ifEmpty { carryPos }
            carryPos = pos
            if (pos.any { it.contains("Wikipedia") }) continue // drop meta senses
            options.add(
                JishoOptionDto(
                    reading = reading,
                    pos = pos,
                    english = sense.englishDefinitions.joinToString(" / "),
                    jlpt = entry.jlpt,
                ),
            )
        }
        return options
    }

    private fun cacheGet(word: String): JishoEntryDto? = try {
        cache.get(KEY_PREFIX + word)
    } catch (e: Exception) {
        logger.warn("jisho cache read failed (word='{}'): {}", word, e.javaClass.simpleName)
        null
    }

    private fun cachePut(word: String, value: JishoEntryDto) {
        try {
            cache.put(KEY_PREFIX + word, value, TTL)
        } catch (e: Exception) {
            logger.warn("jisho cache write failed (word='{}'): {}", word, e.javaClass.simpleName)
        }
    }

    private companion object {
        const val MAX_CONCURRENCY = 3
        const val MAX_ATTEMPTS = 4
        const val KEY_PREFIX = "jisho:"
        val TTL: Duration = Duration.ofDays(30)
        val NOT_FOUND = JishoEntryDto(found = false)
    }
}
