package com.japanese.vocabulary.translation.service.pipeline

import com.japanese.vocabulary.translation.client.jisho.JishoPartOfSpeechMapper
import com.japanese.vocabulary.translation.client.jisho.dto.JishoDictionaryEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import com.japanese.vocabulary.translation.model.LexicalResolution
import com.japanese.vocabulary.translation.model.LexicalResolvedToken
import com.japanese.vocabulary.translation.model.PipelineSenseOption
import com.japanese.vocabulary.translation.model.PipelineToken
import com.japanese.vocabulary.translation.model.PipelineTokenKey
import com.japanese.vocabulary.translation.service.JishoService
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

/**
 * Narrows a jisho lookup to the dictionary entry the token actually means.
 *
 * The lookup key is the headword alone, and one headword can answer with several entries — 前 returns
 * 前[マエ] and, because the `先` entry lists 前 as an alternate spelling, 先[サキ] too. The segmentation
 * stage supplies the other half of the key, `baseFormReading`, and the pair `(headword, reading)`
 * picks one entry. Only that entry's senses reach sense-select, so the model is never asked to choose
 * between meanings belonging to different words.
 *
 * The reading comes from an LLM and can be wrong, which is why a miss is graded rather than dropped:
 * see [JishoLookupProvenance].
 */
@Component
class LexicalResolver(
    private val jishoService: JishoService,
) {
    private val logger = LoggerFactory.getLogger(LexicalResolver::class.java)

    suspend fun resolve(tokens: List<PipelineToken>): LexicalResolution {
        if (tokens.isEmpty()) return LexicalResolution(emptyMap(), emptyMap())

        val firstPass = jishoService.lookupAll(tokens.map { it.headword }.distinct())
        // Narrow once per token and reuse: deciding which tokens need the i-adjective probe asks the
        // same question the main loop asks, and grading twice would also emit every log line twice.
        val narrowed = tokens.associate { it.key to narrow(it, firstPass[it.headword], it.headword) }
        val needsIAdjective = tokens.filter { narrowed[it.key] == null && iAdjectiveProbe(it) != null }
        val iAdjectiveLookups = jishoService.lookupAll(needsIAdjective.mapNotNull { iAdjectiveProbe(it) }.distinct())

        val byToken = linkedMapOf<PipelineTokenKey, LexicalResolvedToken>()
        val optionsById = linkedMapOf<Int, PipelineSenseOption>()
        // One dictionary sense is one senseId for the whole song. The id used to be minted per token
        // occurrence, so a word sung on six lines reached sense-translate six times and the model
        // wrote a different Korean gloss for each: シャイ — a single-sense entry, "shy" — came back as
        // 수줍음이 많은 / 수줍은 / 수줍어하다, and the app stored one word with three near-identical senses.
        val senseIdByIdentity = hashMapOf<SenseIdentity, Int>()
        var nextSenseId = 0

        for (token in tokens) {
            val resolved = narrowed[token.key] ?: resolveIAdjective(token, iAdjectiveLookups)

            if (resolved == null) {
                if (firstPass[token.headword]?.provenance == JishoLookupProvenance.REJECTED_FALLBACK) {
                    logger.info("Rejected unsafe jisho fallback for '{}'", token.headword)
                }
                byToken[token.key] = LexicalResolvedToken(token, token.headword, emptyList())
                continue
            }

            val senseOptions = resolved.entries.flatMap { entry ->
                entry.senses.map { sense ->
                    val identity = SenseIdentity(
                        baseForm = resolved.baseForm,
                        headword = entry.headword,
                        reading = entry.reading,
                        english = sense.english,
                        rawPos = sense.pos,
                        provenance = resolved.provenance,
                    )
                    val senseId = senseIdByIdentity.getOrPut(identity) { nextSenseId++ }
                    optionsById.getOrPut(senseId) {
                        PipelineSenseOption(
                            senseId = senseId,
                            baseForm = resolved.baseForm,
                            headword = entry.headword,
                            reading = entry.reading,
                            partOfSpeech = JishoPartOfSpeechMapper.map(sense.pos),
                            rawPos = sense.pos,
                            english = sense.english,
                            englishDefinitions = sense.englishDefinitions.ifEmpty {
                                sense.english.takeIf { it.isNotBlank() }?.let(::listOf) ?: emptyList()
                            },
                            jlpt = entry.jlpt,
                            provenance = resolved.provenance,
                        )
                    }
                }
            }
            byToken[token.key] = LexicalResolvedToken(token, resolved.baseForm, senseOptions)
        }

        return LexicalResolution(byToken, optionsById)
    }

    /**
     * Grades how well [lookup] pins down the entry [token] means, using the `(headword, reading)` pair.
     *
     * Returns null when nothing usable is left — a rejected fallback, a genuine miss, or a fetch
     * error. Readings are compared as katakana on both sides; the client already normalized jisho's,
     * and the anchoring validator already normalized the segmentation stage's.
     *
     * [expectedReading] overrides the token's own reading, for the i-adjective probe: the probe fires
     * precisely because the token's reading belongs to the wrong headword.
     */
    private fun narrow(
        token: PipelineToken,
        lookup: JishoEntryDto?,
        baseForm: String,
        expectedReading: String? = null,
    ): AcceptedLexicalEntry? {
        if (lookup == null || lookup.entries.isEmpty()) return null
        if (lookup.provenance != JishoLookupProvenance.EXACT) return null

        val baseFormAsKana = JapaneseText.toKatakana(baseForm)
        // The reading clause is what lets a kana headword match at all — かける is written in kana, so
        // かける is the headword and every candidate entry is spelled in kanji.
        val headwordMatches = lookup.entries.filter { it.headword == baseForm || it.reading == baseFormAsKana }
        val reading = (expectedReading ?: token.baseFormReading).takeIf { it.isNotBlank() }

        val exact = reading?.let { r -> headwordMatches.filter { it.reading == r } } ?: emptyList()
        val candidates = exact.ifEmpty { headwordMatches }
        if (candidates.isEmpty()) return null

        val provenance = when {
            // More than one entry survives, so the word is not pinned down whichever way it got here.
            // A kana headword reaches this through `exact`: lyrics write かける in kana, so かける IS
            // the headword, and 掛ける / 賭ける / 欠ける all read カケル. Calling that EXACT would hand the
            // model "to hang" / "to bet" / "to be chipped" with no sign they are different words — the
            // very failure entry boundaries exist to prevent.
            candidates.size > 1 -> JishoLookupProvenance.AMBIGUOUS_HEADWORD
            // The reading missed, but only one entry carries the headword, so there is nothing to
            // confuse it with. Absorbs a wrong reading instead of dropping the word's meaning.
            exact.isEmpty() -> JishoLookupProvenance.APPROVED_FALLBACK
            else -> JishoLookupProvenance.EXACT
        }
        if (provenance != JishoLookupProvenance.EXACT) {
            logger.info(
                "Narrowed '{}' [{}] to {} candidate(s), graded {}",
                baseForm,
                reading,
                candidates.size,
                provenance,
            )
        }
        return AcceptedLexicalEntry(baseForm, candidates, provenance)
    }

    /**
     * Safety net for when the segmentation LLM hands back an adverbial 高く as the headword instead of
     * 高い. Tried only after the pair match has already failed.
     */
    private fun resolveIAdjective(
        token: PipelineToken,
        iAdjectiveLookups: Map<String, JishoEntryDto>,
    ): AcceptedLexicalEntry? {
        val base = iAdjectiveProbe(token) ?: return null
        // The probe only fires when the model gave the wrong headword (高く for 高い), so the token's
        // own reading is that wrong headword's — タカク, which can never equal the probed entry's
        // タカイ. Comparing against it would classify every rescue as a fallback. Inflect the reading
        // the same way the base form was inflected.
        val accepted = narrow(token, iAdjectiveLookups[base], base, iAdjectiveProbeReading(token)) ?: return null
        val adjectiveEntries = accepted.entries.mapNotNull { entry ->
            val adjectiveSenses = entry.senses.filter { sense ->
                sense.pos.any { pos ->
                    val lower = pos.lowercase()
                    "i-adjective" in lower || "keiyoushi" in lower
                }
            }
            if (adjectiveSenses.isEmpty()) null else entry.copy(senses = adjectiveSenses)
        }
        if (adjectiveEntries.isEmpty()) return null
        logger.info("Normalized i-adjective adverbial '{}' to '{}'", token.surface, base)
        return AcceptedLexicalEntry(base, adjectiveEntries, accepted.provenance)
    }

    /** The probed base form's reading: `タカク` → `タカイ`, mirroring [iAdjectiveProbe] on the surface. */
    private fun iAdjectiveProbeReading(token: PipelineToken): String? {
        val reading = token.baseFormReading.takeIf { it.length >= 2 } ?: return null
        if (reading.endsWith("イ")) return reading
        if (!reading.endsWith("ク")) return null
        return reading.dropLast(1) + "イ"
    }

    private fun iAdjectiveProbe(token: PipelineToken): String? {
        if (!token.surface.endsWith("く") || token.surface.length < 2) return null
        if (token.headword.endsWith("い") && token.headword.length >= 2) return token.headword
        return token.surface.dropLast(1) + "い"
    }

    /**
     * What makes two candidate senses the same sense. Everything a [PipelineSenseOption] carries
     * except the id itself — [provenance] included, because it decides whether sense-select is told
     * the entry's headword and reading, so an EXACT hit and an AMBIGUOUS_HEADWORD hit on the same
     * sense are not interchangeable in the prompt.
     */
    private data class SenseIdentity(
        val baseForm: String,
        val headword: String?,
        val reading: String?,
        val english: String,
        val rawPos: List<String>,
        val provenance: JishoLookupProvenance,
    )

    private data class AcceptedLexicalEntry(
        val baseForm: String,
        val entries: List<JishoDictionaryEntryDto>,
        val provenance: JishoLookupProvenance,
    )
}
