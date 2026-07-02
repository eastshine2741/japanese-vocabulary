package com.japanese.vocabulary.translation.service.pipeline

import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.translation.client.jisho.JishoPartOfSpeechMapper
import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import com.japanese.vocabulary.translation.client.jisho.dto.JishoOptionDto
import com.japanese.vocabulary.translation.model.LexicalResolution
import com.japanese.vocabulary.translation.model.LexicalResolvedToken
import com.japanese.vocabulary.translation.model.PipelineSenseOption
import com.japanese.vocabulary.translation.model.PipelineToken
import com.japanese.vocabulary.translation.model.PipelineTokenKey
import com.japanese.vocabulary.translation.service.JishoService
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

@Component
class LexicalResolver(
    private val jishoService: JishoService,
) {
    private val logger = LoggerFactory.getLogger(LexicalResolver::class.java)

    suspend fun resolve(tokens: List<PipelineToken>): LexicalResolution {
        if (tokens.isEmpty()) return LexicalResolution(emptyMap(), emptyMap())

        val firstPass = jishoService.lookupAll(tokens.map { it.dictionaryForm }.distinct())
        val needsIAdjective = tokens.filter { token ->
            acceptedEntry(firstPass[token.dictionaryForm]) == null && iAdjectiveProbe(token) != null
        }
        val iAdjectiveLookups = jishoService.lookupAll(needsIAdjective.mapNotNull { iAdjectiveProbe(it) }.distinct())

        val byToken = linkedMapOf<PipelineTokenKey, LexicalResolvedToken>()
        val optionsById = linkedMapOf<Int, PipelineSenseOption>()
        var nextSenseId = 0

        for (token in tokens) {
            val resolved = acceptedEntry(firstPass[token.dictionaryForm])?.let { entry ->
                AcceptedLexicalEntry(token.dictionaryForm, entry.options, entry.provenance)
            } ?: resolveIAdjective(token, iAdjectiveLookups)

            if (resolved == null) {
                val provenance = firstPass[token.dictionaryForm]?.provenance
                if (provenance == JishoLookupProvenance.REJECTED_FALLBACK) {
                    logger.info("Rejected unsafe jisho fallback for '{}'", token.dictionaryForm)
                }
                byToken[token.key] = LexicalResolvedToken(token, token.dictionaryForm, emptyList())
                continue
            }

            val senseOptions = resolved.options.map { option ->
                val senseId = nextSenseId++
                PipelineSenseOption(
                    senseId = senseId,
                    surface = token.surface,
                    baseForm = resolved.baseForm,
                    reading = option.reading,
                    partOfSpeech = JishoPartOfSpeechMapper.map(option.pos),
                    rawPos = option.pos,
                    english = option.english,
                    englishDefinitions = option.englishDefinitions.ifEmpty {
                        option.english.takeIf { it.isNotBlank() }?.let(::listOf) ?: emptyList()
                    },
                    jlpt = option.jlpt,
                    provenance = resolved.provenance,
                    option = option,
                ).also { optionsById[senseId] = it }
            }
            byToken[token.key] = LexicalResolvedToken(token, resolved.baseForm, senseOptions)
        }

        return LexicalResolution(byToken, optionsById)
    }

    private fun acceptedEntry(entry: JishoEntryDto?): JishoEntryDto? {
        if (entry == null || entry.options.isEmpty()) return null
        return when (entry.provenance) {
            JishoLookupProvenance.EXACT, JishoLookupProvenance.APPROVED_FALLBACK -> entry
            JishoLookupProvenance.REJECTED_FALLBACK,
            JishoLookupProvenance.NOT_FOUND,
            JishoLookupProvenance.FETCH_ERROR -> null
        }
    }

    private fun resolveIAdjective(
        token: PipelineToken,
        iAdjectiveLookups: Map<String, JishoEntryDto>,
    ): AcceptedLexicalEntry? {
        val base = iAdjectiveProbe(token) ?: return null
        val entry = acceptedEntry(iAdjectiveLookups[base]) ?: return null
        val adjectiveOptions = entry.options.filter { option ->
            option.pos.any { pos ->
                val lower = pos.lowercase()
                "i-adjective" in lower || "keiyoushi" in lower
            }
        }
        if (adjectiveOptions.isEmpty()) return null
        logger.info("Normalized i-adjective adverbial '{}' to '{}'", token.surface, base)
        return AcceptedLexicalEntry(base, adjectiveOptions, entry.provenance)
    }

    private fun iAdjectiveProbe(token: PipelineToken): String? {
        if (!token.surface.endsWith("く") || token.surface.length < 2) return null
        if (token.dictionaryForm.endsWith("い") && token.dictionaryForm.length >= 2) return token.dictionaryForm
        return token.surface.dropLast(1) + "い"
    }

    private data class AcceptedLexicalEntry(
        val baseForm: String,
        val options: List<JishoOptionDto>,
        val provenance: JishoLookupProvenance,
    )
}
