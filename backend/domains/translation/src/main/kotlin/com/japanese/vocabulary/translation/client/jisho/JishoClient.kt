package com.japanese.vocabulary.translation.client.jisho

import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryRawDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import com.japanese.vocabulary.translation.client.jisho.dto.JishoOptionDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoSearchResponse
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientResponseException

/**
 * jisho.org API client — network only. Caching, cache-aside orchestration, and bounded-concurrency
 * fan-out live in [com.japanese.vocabulary.translation.service.JishoService].
 *
 * A single [fetch] does one HTTP GET (with 429 backoff) and distills the response into a
 * [JishoEntryDto], faithful to the playground `_jisho_full_fetch`:
 * - **Flatten all senses**: every sense of every exact-match entry (`japanese.word`/`reading` == query)
 *   becomes one [JishoOptionDto] carrying its own reading/POS/EN gloss/JLPT.
 * - **Fallback provenance**: if NO entry exactly matches, jisho's top entry is retained as rejected
 *   fallback evidence. Downstream code must opt in before using fallback candidates.
 * - Returns null on an unrecovered network/HTTP error so the caller skips caching (retries next run).
 */
@Component
class JishoClient(
    restClientBuilder: RestClient.Builder,
) {
    private val logger = LoggerFactory.getLogger(JishoClient::class.java)

    private val restClient = restClientBuilder
        .baseUrl("https://jisho.org")
        .defaultHeader("User-Agent", "JapaneseVocabularyApp/1.0")
        .build()

    /**
     * One network fetch. Returns the distilled entry on HTTP 200 (found or genuine not-found),
     * or null on an unrecovered error. Retries HTTP 429 with increasing delay.
     */
    suspend fun fetch(word: String): JishoEntryDto? {
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
     * Flatten exact-match entries' senses into options. If none match, retain jisho's top entry as
     * rejected fallback evidence rather than silently making it usable.
     * Mirrors `_jisho_full_fetch`'s match policy + `_flatten_entry`.
     */
    private fun distill(word: String, response: JishoSearchResponse): JishoEntryDto {
        val exactOptions = response.data
            .filter { entry -> entry.japanese.any { it.word == word || it.reading == word } }
            .flatMap { flattenEntry(it) }
        if (exactOptions.isNotEmpty()) {
            return JishoEntryDto(
                found = true,
                word = word,
                options = exactOptions,
                provenance = JishoLookupProvenance.EXACT,
            )
        }

        val fallbackOptions = response.data.firstOrNull()?.let { flattenEntry(it) } ?: emptyList()
        if (fallbackOptions.isNotEmpty()) {
            return JishoEntryDto(
                found = false,
                word = word,
                options = fallbackOptions,
                provenance = JishoLookupProvenance.REJECTED_FALLBACK,
                rejectedFallbackReason = "No exact japanese.word or reading matched query",
            )
        }

        return JishoEntryDto(found = false, word = word, provenance = JishoLookupProvenance.NOT_FOUND)
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
                    englishDefinitions = sense.englishDefinitions,
                ),
            )
        }
        return options
    }

    private companion object {
        const val MAX_ATTEMPTS = 4
    }
}
