package com.japanese.vocabulary.translation.client.jisho

import org.springframework.stereotype.Component
import com.japanese.vocabulary.translation.client.jisho.dto.JishoDictionaryEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryRawDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import com.japanese.vocabulary.translation.client.jisho.dto.JishoOptionDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoSearchResponse
import com.japanese.vocabulary.translation.service.pipeline.JapaneseText
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.slf4j.LoggerFactory
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientResponseException

/**
 * jisho.org API client — network only. Caching, cache-aside orchestration, and bounded-concurrency
 * fan-out live in [com.japanese.vocabulary.translation.service.JishoService].
 *
 * A single [fetch] does one HTTP GET (with 429 backoff) and distills the response into a
 * [JishoEntryDto] whose **entry boundaries are preserved**: one [JishoDictionaryEntryDto] per
 * `(headword, reading)` pair the query touched, each carrying only its own senses. Narrowing to one
 * entry is not done here — the query knows the headword but not the reading, and one headword lookup
 * is shared by tokens that read it differently, so the cached value must hold every entry and
 * [com.japanese.vocabulary.translation.service.pipeline.LexicalResolver] picks.
 *
 * Returns null on an unrecovered network/HTTP error so the caller skips caching (retries next run).
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
     * Expands the response into dictionary entries, one per `(headword, reading)` pair.
     *
     * A jisho entry's `japanese[]` block lists every spelling/reading pair the entry owns, and the
     * senses belong to all of them. Each pair becomes its own [JishoDictionaryEntryDto] so a later
     * pair match can name exactly one word. Entries that touch the query at all are kept: if none
     * does, jisho's top hit is retained as rejected-fallback evidence rather than being made usable.
     *
     * A reading is compared as katakana, the way [expandEntry] already stores it. jisho writes its
     * readings in hiragana and lyrics write plenty of native words in katakana, so a literal
     * comparison threw away hits jisho had answered correctly: `アタシ` returns 私[あたし] as its top
     * result, and `あたし != アタシ` turned that into a rejected fallback with no meaning at all.
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
     * The senses are shared across those pairs — that is how jisho models it, and splitting them is
     * what makes 前[マエ] addressable without dragging in 先[サキ]'s meanings from the same raw entry.
     * Readings are converted to katakana here so every downstream comparison and every cached value
     * speaks one script.
     */
    private fun expandEntry(entry: JishoEntryRawDto): List<JishoDictionaryEntryDto> {
        val senses = flattenSenses(entry)
        if (senses.isEmpty()) return emptyList()
        return entry.japanese.mapNotNull { japanese ->
            val reading = readingOf(japanese.reading ?: japanese.word)
            // Nothing to address the entry by. jisho really does ship these — `ソフト・クリーム` and
            // `いすゞ` have readings that are not kana — and a null/null entry can match nothing, so it
            // would only take up room in the cached payload.
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
     * An element normally carries its own kana reading, but a few carry only a written form — and
     * falling back to that would put kanji in a reading field, which then reaches the app's
     * katakana-to-Hangul conversion. A null reading simply cannot match a pair, which downgrades the
     * lookup to a headword match instead of poisoning the entry.
     */
    private fun readingOf(raw: String?): String? {
        if (raw == null) return null
        return JapaneseText.toKatakana(raw).takeIf { JapaneseText.isKanaOnly(it) }
    }

    /** Entry senses in order, dropping meta senses and carrying POS forward the way jisho reports it. */
    private fun flattenSenses(entry: JishoEntryRawDto): List<JishoOptionDto> {
        val senses = mutableListOf<JishoOptionDto>()
        var carryPos: List<String> = emptyList() // jisho repeats POS only when it changes; carry forward
        for (sense in entry.senses) {
            if (sense.englishDefinitions.isEmpty()) continue
            val pos = sense.partsOfSpeech.ifEmpty { carryPos }
            carryPos = pos
            if (pos.any { it.contains("Wikipedia") }) continue // drop meta senses
            senses.add(
                JishoOptionDto(
                    pos = pos,
                    english = sense.englishDefinitions.joinToString(" / "),
                    englishDefinitions = sense.englishDefinitions,
                ),
            )
        }
        return senses
    }

    private companion object {
        const val MAX_ATTEMPTS = 4
    }
}
