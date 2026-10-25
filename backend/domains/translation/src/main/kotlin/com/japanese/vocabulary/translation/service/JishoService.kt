package com.japanese.vocabulary.translation.service

import com.japanese.vocabulary.translation.client.dictionary.JmdictDictionary
import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service

/**
 * Dictionary lookups for the pipeline, answered by the bundled JMdict in jisho's response shape.
 *
 * A read failure (missing or corrupt file) yields [JishoLookupProvenance.FETCH_ERROR], so the line is reported
 * as a provider error rather than "no such word" — the segmentation model must not rewrite a correct headword.
 */
@Service
class JishoService(
    private val dictionary: JmdictDictionary,
) {
    private val logger = LoggerFactory.getLogger(JishoService::class.java)

    suspend fun lookupAll(words: List<String>): Map<String, JishoEntryDto> =
        words.distinct().associateWith { lookup(it) }

    suspend fun lookup(word: String): JishoEntryDto =
        try {
            dictionary.lookup(word)
        } catch (e: Exception) {
            logger.warn("dictionary lookup failed for '{}': {}", word, e.toString())
            JishoEntryDto(found = false, word = word, provenance = JishoLookupProvenance.FETCH_ERROR)
        }
}
