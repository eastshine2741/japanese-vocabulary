package com.japanese.vocabulary.translation.service.pipeline

import com.japanese.vocabulary.song.model.PartOfSpeech
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
        // Narrow once per token and reuse: deciding which tokens need a probe asks the same question
        // the main loop asks, and grading twice would also emit every log line twice.
        val narrowed = tokens.associate { it.key to narrow(it, firstPass[it.headword], it.headword) }
        val probeLookups = jishoService.lookupAll(probeKeys(tokens.filter { narrowed[it.key] == null }))

        val byToken = linkedMapOf<PipelineTokenKey, LexicalResolvedToken>()
        val optionsById = linkedMapOf<Int, PipelineSenseOption>()
        // One dictionary sense is one senseId for the whole song. The id used to be minted per token
        // occurrence, so a word sung on six lines reached sense-translate six times and the model
        // wrote a different Korean gloss for each: シャイ — a single-sense entry, "shy" — came back as
        // 수줍음이 많은 / 수줍은 / 수줍어하다, and the app stored one word with three near-identical senses.
        val senseIdByIdentity = hashMapOf<SenseIdentity, Int>()
        var nextSenseId = 0

        for (token in tokens) {
            val resolved = narrowed[token.key]
                ?: resolveIAdjective(token, probeLookups)
                ?: resolveSuruDesiderative(token, probeLookups)
                ?: resolveAppearanceSou(token, probeLookups)
                ?: resolveHiraganaQuery(token, probeLookups)
                ?: resolveIntensifierPrefix(token, probeLookups)
                ?: resolveSuruVerb(token, probeLookups)

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
     * The tokens no dictionary entry answers — the same verdict [resolve] would reach, asked early.
     *
     * A headword that is not a dictionary form (`帰れない` instead of `帰る`) leaves the token with no
     * candidate sense at all, and every stage downstream treats that as "nothing to choose", so the
     * word reaches the app with no meaning and nothing in the pipeline objects. Answering the question
     * here lets the segmentation stage retry the line while it still can.
     *
     * Each miss says whether the dictionary actually answered. A lookup that errored on every attempt
     * ([JishoLookupProvenance.FETCH_ERROR]) is not a miss the segmentation model can fix, and telling
     * it "no entry exists for 太陽" would make it change a headword that was right.
     *
     * Repeating the lookups costs nothing: [com.japanese.vocabulary.translation.service.JishoService]
     * caches, so [resolve] serves the same keys from Redis afterwards — and an error is never cached,
     * so a retry asks jisho again. Grading is silent here so a probe does not log every narrowing
     * decision twice.
     */
    suspend fun unresolvedTokens(tokens: List<PipelineToken>): List<Unresolved> {
        if (tokens.isEmpty()) return emptyList()

        val firstPass = jishoService.lookupAll(tokens.map { it.headword }.distinct())
        val missed = tokens.filter { narrow(it, firstPass[it.headword], it.headword, logGrading = false) == null }
        if (missed.isEmpty()) return emptyList()

        val probeLookups = jishoService.lookupAll(probeKeys(missed))
        return missed
            .filter {
                resolveIAdjective(it, probeLookups, logRescue = false) == null &&
                    resolveSuruDesiderative(it, probeLookups, logRescue = false) == null &&
                    resolveAppearanceSou(it, probeLookups, logRescue = false) == null &&
                    resolveHiraganaQuery(it, probeLookups, logRescue = false) == null &&
                    resolveIntensifierPrefix(it, probeLookups, logRescue = false) == null &&
                    resolveSuruVerb(it, probeLookups, logRescue = false) == null
            }
            .map { token ->
                val lookups = listOfNotNull(firstPass[token.headword]) +
                    probeKeysOf(token).mapNotNull(probeLookups::get)
                Unresolved(token, providerError = lookups.any { it.provenance == JishoLookupProvenance.FETCH_ERROR })
            }
    }

    /** A token [unresolvedTokens] could not answer, and whether that is jisho's silence or its verdict. */
    data class Unresolved(val token: PipelineToken, val providerError: Boolean)

    /** Every alternate lookup key the rescues below might ask for, in one batch. */
    private fun probeKeys(missed: List<PipelineToken>): List<String> =
        missed.flatMap(::probeKeysOf).distinct()

    private fun probeKeysOf(token: PipelineToken): List<String> =
        listOfNotNull(
            iAdjectiveProbe(token),
            suruDesiderativeProbe(token),
            hiraganaProbe(token),
            intensifierPrefixProbe(token),
            suruVerbProbe(token),
        ) + appearanceSouProbes(token).map { it.baseForm }

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
        logGrading: Boolean = true,
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
        if (logGrading && provenance != JishoLookupProvenance.EXACT) {
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
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        val base = iAdjectiveProbe(token) ?: return null
        // The probe only fires when the model gave the wrong headword (高く for 高い), so the token's
        // own reading is that wrong headword's — タカク, which can never equal the probed entry's
        // タカイ. Comparing against it would classify every rescue as a fallback. Inflect the reading
        // the same way the base form was inflected.
        val accepted = narrow(token, iAdjectiveLookups[base], base, iAdjectiveProbeReading(token), logRescue)
            ?: return null
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
        if (logRescue) logger.info("Normalized i-adjective adverbial '{}' to '{}'", token.surface, base)
        return AcceptedLexicalEntry(base, adjectiveEntries, accepted.provenance)
    }

    /**
     * Safety net for when the segmentation LLM hands back a suru-verb's desiderative — 愛したくない,
     * 愛したい — as the headword instead of 愛する. Tried only after the pair match has already failed.
     *
     * The probe is a guess at the conjugation: 話したい is 話す, not 話する, and it stays unresolved
     * because no entry carries the probed headword. The rescue only ever adds an entry jisho actually
     * indexes under `stem + する`.
     */
    private fun resolveSuruDesiderative(
        token: PipelineToken,
        lookups: Map<String, JishoEntryDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        val base = suruDesiderativeProbe(token) ?: return null
        // Same reasoning as the i-adjective probe: the token's reading is アイシタクナイ, the wrong
        // headword's, so it is inflected back to アイスル alongside the base form.
        val accepted = narrow(token, lookups[base], base, suruDesiderativeProbeReading(token), logRescue)
            ?: return null
        if (logRescue) logger.info("Normalized suru-verb desiderative '{}' to '{}'", token.surface, base)
        return accepted
    }

    /** The probed base form's reading: `アイシタクナイ` → `アイスル`, mirroring [suruDesiderativeProbe]. */
    private fun suruDesiderativeProbeReading(token: PipelineToken): String? {
        val suffix = SURU_DESIDERATIVE_READING_SUFFIXES.firstOrNull { token.baseFormReading.endsWith(it) }
            ?: return null
        val stem = token.baseFormReading.dropLast(suffix.length)
        return if (stem.isEmpty()) null else stem + "スル"
    }

    /** `愛したくない` / `愛したい` → `愛する`. Null when nothing precedes the suffix: したい alone is する. */
    private fun suruDesiderativeProbe(token: PipelineToken): String? {
        val suffix = SURU_DESIDERATIVE_SUFFIXES.firstOrNull { token.headword.endsWith(it) } ?: return null
        val stem = token.headword.dropLast(suffix.length)
        return if (stem.isEmpty()) null else stem + "する"
    }

    /**
     * Safety net for when the segmentation LLM hands back a stem with appearance そう — 泣きそう,
     * 忙しそう — as the headword instead of 泣く / 忙しい. Tried only after the pair match has already failed.
     *
     * The stem does not say which word class it came from, so every restoration is asked for: stem + い
     * as an i-adjective, the last i-row kana moved to the u-row as a godan verb, stem + る as an ichidan
     * verb. Each keeps only the senses of the class it guessed, so a guess jisho happens to answer with
     * a noun adds nothing.
     */
    private fun resolveAppearanceSou(
        token: PipelineToken,
        lookups: Map<String, JishoEntryDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        for (probe in appearanceSouProbes(token)) {
            val accepted = narrow(token, lookups[probe.baseForm], probe.baseForm, probe.reading, logRescue)
                ?: continue
            val matchingEntries = accepted.entries.mapNotNull { entry ->
                val senses = entry.senses.filter { JishoPartOfSpeechMapper.map(it.pos) == probe.partOfSpeech }
                if (senses.isEmpty()) null else entry.copy(senses = senses)
            }
            if (matchingEntries.isEmpty()) continue
            if (logRescue) logger.info("Normalized appearance sou '{}' to '{}'", token.headword, probe.baseForm)
            return AcceptedLexicalEntry(probe.baseForm, matchingEntries, accepted.provenance)
        }
        return null
    }

    /** `泣きそう` → `泣く`, `忙しそう` → `忙しい`, `食べそう` → `食べる`, with readings inflected alike. */
    private fun appearanceSouProbes(token: PipelineToken): List<AppearanceSouProbe> {
        if (!token.headword.endsWith("そう")) return emptyList()
        val stem = token.headword.dropLast(2).takeIf { it.isNotEmpty() } ?: return emptyList()
        val readingStem = token.baseFormReading.takeIf { it.endsWith("ソウ") }?.dropLast(2)?.takeIf { it.isNotEmpty() }

        val probes = mutableListOf(
            AppearanceSouProbe(stem + "い", readingStem?.plus("イ"), PartOfSpeech.ADJECTIVE),
        )
        GODAN_I_TO_U[stem.last()]?.let { u ->
            val reading = readingStem?.let { r ->
                GODAN_I_TO_U[JapaneseText.toHiragana(r.takeLast(1)).single()]
                    ?.let { r.dropLast(1) + JapaneseText.toKatakana(it.toString()) }
            }
            probes += AppearanceSouProbe(stem.dropLast(1) + u, reading, PartOfSpeech.VERB)
        }
        probes += AppearanceSouProbe(stem + "る", readingStem?.plus("ル"), PartOfSpeech.VERB)
        return probes
    }

    private data class AppearanceSouProbe(
        val baseForm: String,
        val reading: String?,
        val partOfSpeech: PartOfSpeech,
    )

    /**
     * Safety net for a word the lyric writes in katakana and the dictionary indexes in hiragana.
     *
     * `アタシ`, `アンタ`, `アナタ` are dictionary words — 私, 貴方 — but jisho's *search* answers a
     * katakana query with katakana headwords only: `アンタ` returns アンタレス and アンタナナリボ, never
     * 貴方. Nothing about the token is wrong here, only the script of the query, so it is asked again
     * in hiragana. The accepted entry then reports `あたし` as the base form, which also merges the
     * word with the lines where the segmentation stage happened to normalize the script itself — the
     * same lyric had `アタシ` with a meaning on one line and without on the next.
     */
    private fun resolveHiraganaQuery(
        token: PipelineToken,
        lookups: Map<String, JishoEntryDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        val base = hiraganaProbe(token) ?: return null
        // The reading survives the script switch untouched — アタシ is what the line says either way —
        // so the pair match still applies and a katakana-only coinage simply misses again.
        val accepted = narrow(token, lookups[base], base, logGrading = logRescue) ?: return null
        if (logRescue) logger.info("Looked up katakana headword '{}' as '{}'", token.headword, base)
        return accepted
    }

    /**
     * Safety net for a verb the lyric intensifies with colloquial ぶち / ぶっ (ぶち壊れる, ぶっ飛ぶ).
     *
     * jisho indexes only a handful of these compounds, but the verb underneath is ordinary, so the
     * prefix is dropped and the remainder asked for. Only verb senses are accepted: the prefix
     * attaches to verbs alone, and a stripped remainder that answers with a noun is a different word.
     */
    private fun resolveIntensifierPrefix(
        token: PipelineToken,
        lookups: Map<String, JishoEntryDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        val base = intensifierPrefixProbe(token) ?: return null
        val accepted = narrow(token, lookups[base], base, intensifierPrefixProbeReading(token), logRescue)
            ?: return null
        val verbEntries = accepted.entries.mapNotNull { entry ->
            val verbSenses = entry.senses.filter { JishoPartOfSpeechMapper.map(it.pos) == PartOfSpeech.VERB }
            if (verbSenses.isEmpty()) null else entry.copy(senses = verbSenses)
        }
        if (verbEntries.isEmpty()) return null
        if (logRescue) logger.info("Stripped intensifier prefix from '{}' to '{}'", token.headword, base)
        return AcceptedLexicalEntry(base, verbEntries, accepted.provenance)
    }

    /** The headword without its ぶち / ぶっ prefix. Null when there is no prefix or nothing follows it. */
    private fun intensifierPrefixProbe(token: PipelineToken): String? {
        val prefix = INTENSIFIER_PREFIXES.firstOrNull { token.headword.startsWith(it) } ?: return null
        return token.headword.removePrefix(prefix).takeIf { it.isNotEmpty() }
    }

    /** The probed base form's reading: `ブチコワレル` → `コワレル`, mirroring [intensifierPrefixProbe]. */
    private fun intensifierPrefixProbeReading(token: PipelineToken): String? {
        val prefix = INTENSIFIER_PREFIXES.map(JapaneseText::toKatakana)
            .firstOrNull { token.baseFormReading.startsWith(it) } ?: return null
        return token.baseFormReading.removePrefix(prefix).takeIf { it.isNotEmpty() }
    }

    /**
     * Safety net for a noun+する verb the dictionary indexes only as the noun.
     *
     * jisho has no entry for `交差する`; 交差 is a noun tagged "Suru verb", so the headword the
     * segmentation stage correctly gave misses outright. The noun is asked instead, and only its
     * suru-verb senses are kept so the verb does not pick up the bare noun's meanings.
     */
    private fun resolveSuruVerb(
        token: PipelineToken,
        lookups: Map<String, JishoEntryDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        val base = suruVerbProbe(token) ?: return null
        // The token's reading covers する (コウサスル), so strip it the same way the headword was.
        val reading = token.baseFormReading.takeIf { it.endsWith("スル") }?.dropLast(2)
        val accepted = narrow(token, lookups[base], base, reading, logRescue) ?: return null
        val verbEntries = accepted.entries.mapNotNull { entry ->
            val verbSenses = entry.senses.filter { sense -> sense.pos.any { "suru verb" in it.lowercase() } }
            if (verbSenses.isEmpty()) null else entry.copy(senses = verbSenses)
        }
        if (verbEntries.isEmpty()) return null
        if (logRescue) logger.info("Looked up suru verb '{}' as noun '{}'", token.headword, base)
        return AcceptedLexicalEntry(base, verbEntries, accepted.provenance)
    }

    /** `交差する` → `交差`. Null unless the headword is something followed by する. */
    private fun suruVerbProbe(token: PipelineToken): String? =
        token.headword.takeIf { it.length > 2 && it.endsWith("する") }?.dropLast(2)

    /**
     * The hiragana spelling of a katakana-only headword. Null for anything else: a kanji or hiragana
     * headword already queried the script the dictionary indexes.
     */
    private fun hiraganaProbe(token: PipelineToken): String? =
        token.headword.takeIf { JapaneseText.isKatakanaOnly(it) }?.let { JapaneseText.toHiragana(it) }

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

    private companion object {
        val INTENSIFIER_PREFIXES = listOf("ぶち", "ぶっ")

        /** A godan verb's stem kana (泣き) to its dictionary-form kana (泣く). */
        val GODAN_I_TO_U = mapOf(
            'い' to 'う', 'き' to 'く', 'ぎ' to 'ぐ', 'し' to 'す', 'ち' to 'つ',
            'に' to 'ぬ', 'び' to 'ぶ', 'み' to 'む', 'り' to 'る',
        )

        /** Longest first, so したくない is not read as したい with a stem ending in く. */
        val SURU_DESIDERATIVE_SUFFIXES = listOf("したくない", "したい")
        val SURU_DESIDERATIVE_READING_SUFFIXES = listOf("シタクナイ", "シタイ")
    }
}
