package com.japanese.vocabulary.translation.client.jisho

import org.springframework.stereotype.Component
import com.japanese.vocabulary.translation.client.jisho.dto.JishoDictionaryEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryRawDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import com.japanese.vocabulary.translation.client.jisho.dto.JishoOptionDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoSearchResponse
import com.japanese.vocabulary.translation.service.pipeline.JapaneseText
import com.japanese.vocabulary.common.retry.ExponentialBackoff
import com.japanese.vocabulary.common.retry.TransientHttpErrors
import com.japanese.vocabulary.common.retry.currentRetryDeadline
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientResponseException
import java.time.Duration

/**
 * jisho.org API client — network only. Caching, cache-aside orchestration, and bounded-concurrency
 * fan-out live in [com.japanese.vocabulary.translation.service.JishoService].
 *
 * A single [fetch] does one HTTP GET (retrying transient failures) and distills the response into a
 * [JishoEntryDto] with one [JishoDictionaryEntryDto] per `(headword, reading)` pair the query
 * touched. Narrowing is left to [com.japanese.vocabulary.translation.service.pipeline.LexicalResolver]
 * because one headword lookup is shared by tokens with different readings.
 *
 * Returns null on an unrecovered network/HTTP error so the caller skips caching.
 */
@Component
class JishoClient(
    restClientBuilder: RestClient.Builder,
    @Value("\${jisho.retry.max-attempts:4}") maxAttempts: Int,
    @Value("\${jisho.retry.initial-backoff:2s}") initialBackoff: Duration,
) {
    private val logger = LoggerFactory.getLogger(JishoClient::class.java)
    private val backoff = ExponentialBackoff(maxAttempts, initialBackoff)

    private val restClient = restClientBuilder
        .baseUrl("https://jisho.org")
        .defaultHeader("User-Agent", "JapaneseVocabularyApp/1.0")
        .build()

    /**
     * One network fetch. Returns the distilled entry on HTTP 200 (found or genuine not-found),
     * or null once every attempt has failed.
     *
     * Transient failures (5xx, 429, dropped connection; [TransientHttpErrors]) are retried with
     * [ExponentialBackoff], like Gemini calls. Anything else (a 4xx, an unparseable body) is final
     * and returns null at once.
     *
     * The warning is logged once, after the last attempt, to avoid one outage becoming many Sentry events.
     */
    suspend fun fetch(word: String): JishoEntryDto? {
        var attempts = 0
        return try {
            backoff.retry(
                isTransient = TransientHttpErrors::isTransient,
                atLeast = TransientHttpErrors::retryAfter,
                deadline = currentRetryDeadline(),
                sleep = { delay(it.toMillis()) },
            ) { attempt ->
                attempts = attempt
                val response = withContext(Dispatchers.IO) {
                    restClient.get()
                        .uri { it.path("/api/v1/search/words").queryParam("keyword", word).build() }
                        .retrieve()
                        .body(JishoSearchResponse::class.java)
                } ?: JishoSearchResponse()
                distill(word, response)
            }
        } catch (e: Exception) {
            logger.warn("jisho lookup failed for '{}' after {} attempt(s): {}", word, attempts, describe(e))
            null
        }
    }

    private fun describe(e: Exception): String = when (e) {
        is RestClientResponseException -> "HTTP ${e.statusCode.value()}"
        else -> e.javaClass.simpleName
    }

    /**
     * Expands the response into dictionary entries, one per `(headword, reading)` pair.
     *
     * Each spelling/reading pair in an entry's `japanese[]` block becomes its own
     * [JishoDictionaryEntryDto]. Entries touching the query are kept; if none does, jisho's top hit
     * is retained only as rejected-fallback evidence.
     *
     * Readings are compared as katakana, as [expandEntry] stores them: jisho answers in hiragana but
     * lyrics write native words in katakana (`アタシ` vs 私[あたし]).
     */
    internal fun distill(word: String, response: JishoSearchResponse): JishoEntryDto {
        val queryAsKana = JapaneseText.toKatakana(word)
        val matching = response.data
            .filter { entry ->
                entry.japanese.any { it.word == word || it.reading?.let(JapaneseText::toKatakana) == queryAsKana }
            }
            .flatMap { expandEntry(it) }
        if (matching.isNotEmpty()) {
            return JishoEntryDto(
                found = true,
                word = word,
                entries = matching,
                provenance = JishoLookupProvenance.EXACT,
            )
        }

        val fallback = response.data.firstOrNull()?.let { expandEntry(it) } ?: emptyList()
        if (fallback.isNotEmpty()) {
            return JishoEntryDto(
                found = false,
                word = word,
                entries = fallback,
                provenance = JishoLookupProvenance.REJECTED_FALLBACK,
                rejectedFallbackReason = "No exact japanese.word or reading matched query",
            )
        }

        return JishoEntryDto(found = false, word = word, provenance = JishoLookupProvenance.NOT_FOUND)
    }

    /**
     * One raw jisho entry → one [JishoDictionaryEntryDto] per spelling/reading pair it lists.
     *
     * The senses are shared across those pairs; splitting the pairs makes 前[マエ] addressable without
     * 先[サキ]'s meanings. Readings are converted to katakana here.
     */
    private fun expandEntry(entry: JishoEntryRawDto): List<JishoDictionaryEntryDto> {
        val senses = flattenSenses(entry)
        if (senses.isEmpty()) return emptyList()
        return entry.japanese.mapNotNull { japanese ->
            val reading = readingOf(japanese.reading ?: japanese.word)
            // Nothing to address the entry by (jisho ships these, e.g. `ソフト・クリーム` with non-kana readings).
            if (japanese.word == null && reading == null) return@mapNotNull null
            JishoDictionaryEntryDto(
                headword = japanese.word,
                reading = reading,
                jlpt = entry.jlpt,
                senses = senses,
            )
        }
    }

    /**
     * A reading, or null when jisho gave something that is not one.
     *
     * A few elements carry only a written form; falling back to it would put kanji in a reading field
     * that reaches the app's katakana-to-Hangul conversion. A null reading downgrades the lookup to a
     * headword match.
     */
    private fun readingOf(raw: String?): String? {
        if (raw == null) return null
        return JapaneseText.toKatakana(raw).takeIf { JapaneseText.isKanaOnly(it) }
    }

    /**
     * Entry senses in order, dropping meta senses and carrying POS forward the way jisho reports it.
     *
     * Wikipedia senses are dropped unless nothing else remains (proper nouns such as 楊貴妃).
     */
    private fun flattenSenses(entry: JishoEntryRawDto): List<JishoOptionDto> {
        val all = mutableListOf<JishoOptionDto>()
        var carryPos: List<String> = emptyList() // jisho repeats POS only when it changes; carry forward
        for (sense in entry.senses) {
            if (sense.englishDefinitions.isEmpty()) continue
            val pos = sense.partsOfSpeech.ifEmpty { carryPos }
            carryPos = pos
            all.add(
                JishoOptionDto(
                    pos = pos,
                    english = sense.englishDefinitions.joinToString(" / "),
                    englishDefinitions = sense.englishDefinitions,
                ),
            )
        }
        val real = all.filterNot { option -> option.pos.any { it.contains("Wikipedia") } } // drop meta senses
        return real.ifEmpty { all }
    }
}
