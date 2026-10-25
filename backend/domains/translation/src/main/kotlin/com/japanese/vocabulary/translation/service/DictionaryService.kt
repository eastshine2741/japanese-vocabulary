package com.japanese.vocabulary.translation.service

import com.japanese.vocabulary.translation.client.dictionary.JmdictDictionary
import com.japanese.vocabulary.translation.client.dictionary.dto.DictionaryLookupDto
import com.japanese.vocabulary.translation.client.dictionary.dto.DictionaryLookupProvenance
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service

/**
 * Dictionary lookups for the pipeline, answered by the bundled JMdict.
 *
 * A read failure (missing or corrupt file) yields [DictionaryLookupProvenance.FETCH_ERROR], so the line is reported
 * as a provider error rather than "no such word" — the segmentation model must not rewrite a correct headword.
 */
@Service
class DictionaryService(
    private val dictionary: JmdictDictionary,
) {
    private val logger = LoggerFactory.getLogger(DictionaryService::class.java)

    suspend fun lookupAll(words: List<String>): Map<String, DictionaryLookupDto> =
        words.distinct().associateWith { lookup(it) }

    suspend fun lookup(word: String): DictionaryLookupDto =
        try {
            dictionary.lookup(word)
        } catch (e: Exception) {
            logger.warn("dictionary lookup failed for '{}': {}", word, e.toString())
            DictionaryLookupDto(found = false, word = word, provenance = DictionaryLookupProvenance.FETCH_ERROR)
        }
}
