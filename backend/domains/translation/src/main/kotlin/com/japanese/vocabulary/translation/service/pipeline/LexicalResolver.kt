package com.japanese.vocabulary.translation.service.pipeline

import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.translation.client.dictionary.DictionaryPartOfSpeechMapper
import com.japanese.vocabulary.translation.client.dictionary.dto.DictionaryEntryDto
import com.japanese.vocabulary.translation.client.dictionary.dto.DictionaryLookupDto
import com.japanese.vocabulary.translation.client.dictionary.dto.DictionaryLookupProvenance
import com.japanese.vocabulary.translation.model.LexicalResolution
import com.japanese.vocabulary.translation.model.LexicalResolvedToken
import com.japanese.vocabulary.translation.model.PipelineSenseOption
import com.japanese.vocabulary.translation.model.PipelineToken
import com.japanese.vocabulary.translation.model.PipelineTokenKey
import com.japanese.vocabulary.translation.service.DictionaryService
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

/**
 * Narrows a dictionary lookup to the dictionary entry the token actually means.
 *
 * The lookup key is the headword alone, and one headword can answer with several entries (前 returns
 * 前[マエ] and 先[サキ]). The pair `(headword, baseFormReading)` picks one entry, so sense-select
 * never chooses between different words' meanings. The LLM's reading can be wrong, so a miss is
 * graded rather than dropped: see [DictionaryLookupProvenance].
 */
@Component
class LexicalResolver(
    private val dictionaryService: DictionaryService,
) {
    private val logger = LoggerFactory.getLogger(LexicalResolver::class.java)

    suspend fun resolve(lyricTokens: List<PipelineToken>): LexicalResolution {
        if (lyricTokens.isEmpty()) return LexicalResolution(emptyMap(), emptyMap())

        val tokens = lyricTokens.map(::withStandardKanji)
        val firstPass = dictionaryService.lookupAll(tokens.map { it.headword }.distinct())
        // Narrow once per token and reuse; grading twice would emit every log line twice.
        val narrowed = tokens.associate { it.key to narrow(it, firstPass[it.headword], it.headword) }
        val potentialVerbProbes = tokens
            .filter { narrowed[it.key]?.let(::isPotentialVerbEntry) == true }
            .mapNotNull(::potentialFormProbe)
        val homophoneProbes = tokens
            .filter { token -> narrowed[token.key]?.let { isKanaHomophoneOnly(token, it) } == true }
            .mapNotNull { negativeVerbProbe(it.headword) }
        val probeLookups = dictionaryService.lookupAll(
            (probeKeys(tokens.filter { narrowed[it.key] == null }) + potentialVerbProbes + homophoneProbes).distinct(),
        )

        val byToken = linkedMapOf<PipelineTokenKey, LexicalResolvedToken>()
        val optionsById = linkedMapOf<Int, PipelineSenseOption>()
        // One dictionary sense is one senseId for the whole song; per-occurrence ids made
        // sense-translate write a different Korean gloss for each repeat of the same word.
        val senseIdByIdentity = hashMapOf<SenseIdentity, Int>()
        var nextSenseId = 0

        for (token in tokens) {
            val resolved = narrowed[token.key]?.let { exact ->
                when {
                    isPotentialVerbEntry(exact) -> resolvePotentialForm(token, probeLookups) ?: exact
                    isKanaHomophoneOnly(token, exact) -> resolveNegativeVerb(token, probeLookups) ?: exact
                    else -> exact
                }
            }
                ?: resolveIAdjective(token, probeLookups)
                ?: resolveSuruDesiderative(token, probeLookups)
                ?: resolveDesiderative(token, probeLookups)
                ?: resolveHiraganaQuery(token, probeLookups)
                ?: resolveSmallVowelElongation(token, probeLookups)
                ?: resolveIntensifierPrefix(token, probeLookups)
                ?: resolveSuruVerb(token, probeLookups)
                ?: resolveLongVowelSpelling(token, probeLookups)
                ?: resolveKanjiVariant(token, probeLookups)
                ?: resolveReadingQuery(token, probeLookups)
                ?: resolveHonorificPrefix(token, probeLookups)
                ?: resolveContinuativeNoun(token, probeLookups)
                ?: resolveSuruPassive(token, probeLookups)
                ?: resolvePassive(token, probeLookups)
                ?: resolveAppearanceSou(token, probeLookups)
                ?: resolveCompletionSuffix(token, probeLookups)
                ?: resolveTeAuxiliary(token, probeLookups)
                ?: resolveCausative(token, probeLookups)
                ?: resolveIchidanVolitional(token, probeLookups)
                ?: resolveNegativeVerb(token, probeLookups)
                ?: resolvePotentialForm(token, probeLookups)
                ?: resolveGodanRenyokei(token, probeLookups)
                ?: resolvePotentialNegative(token, probeLookups)
                ?: resolveNaAdjectiveAttributive(token, probeLookups)
                ?: resolveCutShortInterjection(token, probeLookups)
                ?: resolveNumeralCounter(token, probeLookups)

            if (resolved == null) {
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
                            partOfSpeech = DictionaryPartOfSpeechMapper.map(sense.pos),
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
     * The tokens no dictionary entry answers: the verdict [resolve] would reach, asked early so the
     * segmentation stage can retry the line. A non-dictionary headword (`帰れない` for `帰る`) would
     * otherwise ship with no meaning and nothing downstream objecting.
     *
     * Each miss says whether the dictionary actually answered: a [DictionaryLookupProvenance.FETCH_ERROR]
     * is not fixable by the segmentation model, and "no entry exists" would make it change a right headword.
     *
     * Lookups are local and cheap, so [resolve] repeats them. Grading is silent here to avoid duplicate logs.
     */
    suspend fun unresolvedTokens(lyricTokens: List<PipelineToken>): List<Unresolved> {
        if (lyricTokens.isEmpty()) return emptyList()

        val tokens = lyricTokens.map(::withStandardKanji)
        val firstPass = dictionaryService.lookupAll(tokens.map { it.headword }.distinct())
        val missed = tokens.filter { narrow(it, firstPass[it.headword], it.headword, logGrading = false) == null }
        if (missed.isEmpty()) return emptyList()

        val probeLookups = dictionaryService.lookupAll(probeKeys(missed))
        return missed
            .filter {
                resolveIAdjective(it, probeLookups, logRescue = false) == null &&
                    resolveSuruDesiderative(it, probeLookups, logRescue = false) == null &&
                    resolveDesiderative(it, probeLookups, logRescue = false) == null &&
                    resolveHiraganaQuery(it, probeLookups, logRescue = false) == null &&
                    resolveSmallVowelElongation(it, probeLookups, logRescue = false) == null &&
                    resolveIntensifierPrefix(it, probeLookups, logRescue = false) == null &&
                    resolveSuruVerb(it, probeLookups, logRescue = false) == null &&
                    resolveLongVowelSpelling(it, probeLookups, logRescue = false) == null &&
                    resolveKanjiVariant(it, probeLookups, logRescue = false) == null &&
                    resolveReadingQuery(it, probeLookups, logRescue = false) == null &&
                    resolveHonorificPrefix(it, probeLookups, logRescue = false) == null &&
                    resolveContinuativeNoun(it, probeLookups, logRescue = false) == null &&
                    resolveSuruPassive(it, probeLookups, logRescue = false) == null &&
                    resolvePassive(it, probeLookups, logRescue = false) == null &&
                    resolveAppearanceSou(it, probeLookups, logRescue = false) == null &&
                    resolveCompletionSuffix(it, probeLookups, logRescue = false) == null &&
                    resolveTeAuxiliary(it, probeLookups, logRescue = false) == null &&
                    resolveCausative(it, probeLookups, logRescue = false) == null &&
                    resolveIchidanVolitional(it, probeLookups, logRescue = false) == null &&
                    resolveNegativeVerb(it, probeLookups, logRescue = false) == null &&
                    resolvePotentialForm(it, probeLookups, logRescue = false) == null &&
                    resolveGodanRenyokei(it, probeLookups, logRescue = false) == null &&
                    resolvePotentialNegative(it, probeLookups, logRescue = false) == null &&
                    resolveNaAdjectiveAttributive(it, probeLookups, logRescue = false) == null &&
                    resolveCutShortInterjection(it, probeLookups, logRescue = false) == null &&
                    resolveNumeralCounter(it, probeLookups, logRescue = false) == null
            }
            .map { token ->
                val lookups = listOfNotNull(firstPass[token.headword]) +
                    probeKeysOf(token).mapNotNull(probeLookups::get)
                Unresolved(token, providerError = lookups.any { it.provenance == DictionaryLookupProvenance.FETCH_ERROR })
            }
    }

    /** A token [unresolvedTokens] could not answer, and whether that is a read failure or a real miss. */
    data class Unresolved(val token: PipelineToken, val providerError: Boolean)

    /** Every alternate lookup key the rescues below might ask for, in one batch. */
    private fun probeKeys(missed: List<PipelineToken>): List<String> =
        missed.flatMap(::probeKeysOf).distinct()

    private fun probeKeysOf(token: PipelineToken): List<String> =
        listOfNotNull(
            iAdjectiveProbe(token),
            hiraganaProbe(token),
            smallVowelProbe(token),
            intensifierPrefixProbe(token),
            suruVerbProbe(token),
            longVowelProbe(token),
            kanjiVariantProbe(token),
            readingProbe(token),
            honorificPrefixProbe(token),
            continuativeNounProbe(token),
            suruPassiveProbe(token),
            passiveProbe(token),
            negativeVerbProbe(token.headword),
            potentialFormProbe(token),
            godanRenyokeiProbe(token),
            potentialNegativeProbe(token),
            ichidanVolitionalProbe(token),
            naAdjectiveAttributiveProbe(token),
            cutShortInterjectionProbe(token),
            numeralCounterProbe(token),
        ) + suruDesiderativeProbes(token) +
            desiderativeProbes(token).map { it.baseForm } +
            appearanceSouProbes(token).map { it.baseForm } +
            completionSuffixProbes(token).map { it.first } +
            teAuxiliaryProbes(token).map { it.first } +
            causativeProbes(token).map { it.baseForm }

    /**
     * Grades how well [lookup] pins down the entry [token] means, using the `(headword, reading)` pair.
     *
     * Returns null when nothing usable is left (rejected fallback, genuine miss, fetch error).
     * Readings are compared as katakana on both sides (both already normalized).
     *
     * [expectedReading] overrides the token's own reading for probes, whose token reading belongs to
     * the wrong headword.
     */
    private fun narrow(
        token: PipelineToken,
        lookup: DictionaryLookupDto?,
        baseForm: String,
        expectedReading: String? = null,
        logGrading: Boolean = true,
    ): AcceptedLexicalEntry? {
        if (lookup == null || lookup.entries.isEmpty()) return null
        if (lookup.provenance != DictionaryLookupProvenance.EXACT) return null

        val baseFormAsKana = JapaneseText.toKatakana(baseForm)
        // The reading clause lets a kana headword match at all (かける vs kanji-spelled entries).
        // A kana headword ending in a particle is likely glued (うちに); a kanji word the corpus never saw, reached only
        // by that reading (打ち荷), is not what the lyric meant. たまゆら (玉響) ends in no particle and keeps its entry.
        val gluedKana = JapaneseText.isKanaOnly(token.headword) && token.headword.last() in GLUED_PARTICLE_ENDINGS
        val headwordMatches = lookup.entries.filter { it.headword == baseForm || it.reading == baseFormAsKana }
            .filterNot { gluedKana && it.headword != null && it.headword != baseForm && !it.seenInCorpus }
        val reading = (expectedReading ?: token.baseFormReading).takeIf { it.isNotBlank() }

        val exact = reading?.let { r -> headwordMatches.filter { it.reading == r } } ?: emptyList()
        val candidates = exact.ifEmpty { headwordMatches }
        if (candidates.isEmpty()) return null

        val provenance = when {
            // More than one entry survives, so the word is not pinned down. A kana headword (かける)
            // reaches this through `exact`; calling it EXACT would offer 掛ける / 賭ける / 欠ける senses
            // with no sign they are different words.
            candidates.size > 1 -> DictionaryLookupProvenance.AMBIGUOUS_HEADWORD
            // The reading missed but only one entry carries the headword; absorbs a wrong reading.
            exact.isEmpty() -> DictionaryLookupProvenance.APPROVED_FALLBACK
            else -> DictionaryLookupProvenance.EXACT
        }
        if (logGrading && provenance != DictionaryLookupProvenance.EXACT) {
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
     * 高い, or a classical terminal form such as 恙なし that the dictionary indexes only as 恙ない. Tried only
     * after the pair match has already failed.
     */
    private fun resolveIAdjective(
        token: PipelineToken,
        iAdjectiveLookups: Map<String, DictionaryLookupDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        val base = iAdjectiveProbe(token) ?: return null
        // The token's reading is the wrong headword's (タカク, never the probed タカイ), so inflect it the
        // same way as the base form.
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
     * The し before たい is ambiguous: 愛したい is 愛する, but 吐き出したい is the godan verb 吐き出す.
     * Both are probed, `stem + する` first, and the rescue only ever adds an entry the dictionary actually
     * indexes under the probed headword.
     */
    private fun resolveSuruDesiderative(
        token: PipelineToken,
        lookups: Map<String, DictionaryLookupDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        // As in the i-adjective probe, the reading (アイシタクナイ) is inflected back to アイスル with the base form.
        val readings = suruDesiderativeProbeReadings(token)
        for ((index, base) in suruDesiderativeProbes(token).withIndex()) {
            val accepted = narrow(token, lookups[base], base, readings.getOrNull(index), logRescue) ?: continue
            if (logRescue) logger.info("Normalized suru-verb desiderative '{}' to '{}'", token.surface, base)
            return accepted
        }
        return null
    }

    /** The probed base forms' readings: `アイシタクナイ` → `アイスル`, `アイス`, mirroring [suruDesiderativeProbes]. */
    private fun suruDesiderativeProbeReadings(token: PipelineToken): List<String> {
        val suffix = SURU_DESIDERATIVE_READING_SUFFIXES.firstOrNull { token.baseFormReading.endsWith(it) }
            ?: return emptyList()
        val stem = token.baseFormReading.dropLast(suffix.length)
        return if (stem.isEmpty()) emptyList() else listOf(stem + "スル", stem + "ス")
    }

    /** `愛したくない` / `愛したい` → `愛する`, `愛す`. Empty when nothing precedes the suffix: したい alone is する. */
    private fun suruDesiderativeProbes(token: PipelineToken): List<String> {
        val suffix = SURU_DESIDERATIVE_SUFFIXES.firstOrNull { token.headword.endsWith(it) } ?: return emptyList()
        val stem = token.headword.dropLast(suffix.length)
        return if (stem.isEmpty()) emptyList() else listOf(stem + "する", stem + "す")
    }

    /**
     * Safety net for a word the lyric writes in katakana and the dictionary indexes in hiragana.
     *
     * `アタシ`, `アンタ`, `アナタ` are dictionary words (私, 貴方) indexed by their hiragana reading, so
     * they are asked again in hiragana. The accepted entry reports `あたし` as the base form, merging the
     * word with lines where segmentation normalized the script itself.
     */
    private fun resolveHiraganaQuery(
        token: PipelineToken,
        lookups: Map<String, DictionaryLookupDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        val base = hiraganaProbe(token) ?: return null
        // The reading survives the script switch, so the pair match still applies.
        val accepted = narrow(token, lookups[base], base, logGrading = logRescue) ?: return null
        if (logRescue) logger.info("Looked up katakana headword '{}' as '{}'", token.headword, base)
        return accepted
    }

    /**
     * Safety net for a headword the lyric stretches with a small vowel kana: `さぁ` is the interjection
     * さあ drawn out, and the dictionary indexes only `さあ`. The reading is written full size the same way, so
     * the pair match still decides.
     */
    private fun resolveSmallVowelElongation(
        token: PipelineToken,
        lookups: Map<String, DictionaryLookupDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        val base = smallVowelProbe(token) ?: return null
        val reading = JapaneseText.fullSizeTrailingVowel(token.baseFormReading) ?: token.baseFormReading
        val accepted = narrow(token, lookups[base], base, reading, logRescue) ?: return null
        if (logRescue) logger.info("Looked up small-vowel headword '{}' as '{}'", token.headword, base)
        return accepted
    }

    /** `さぁ` → `さあ`. Null unless the headword ends in a small hiragana vowel. */
    private fun smallVowelProbe(token: PipelineToken): String? =
        token.headword.takeIf { it.length >= 2 && !JapaneseText.isKatakanaOnly(it) }
            ?.let(JapaneseText::fullSizeTrailingVowel)

    /**
     * Safety net for a verb the lyric intensifies with colloquial ぶち / ぶっ (ぶち壊れる, ぶっ飛ぶ).
     *
     * The dictionary indexes only a few of these compounds, so the prefix is dropped and the remainder asked
     * for. Only verb senses are accepted; a noun answer is a different word.
     */
    private fun resolveIntensifierPrefix(
        token: PipelineToken,
        lookups: Map<String, DictionaryLookupDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        val base = intensifierPrefixProbe(token) ?: return null
        val accepted = narrow(token, lookups[base], base, intensifierPrefixProbeReading(token), logRescue)
            ?: return null
        val verbEntries = accepted.entries.mapNotNull { entry ->
            val verbSenses = entry.senses.filter { DictionaryPartOfSpeechMapper.map(it.pos) == PartOfSpeech.VERB }
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
     * The dictionary has no entry for `交差する`; 交差 is a noun tagged "Suru verb". The noun is asked instead
     * and only its suru-verb senses are kept.
     */
    private fun resolveSuruVerb(
        token: PipelineToken,
        lookups: Map<String, DictionaryLookupDto>,
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

    /**
     * Safety net for a word the lyric writes with a variant kanji (異体字) the dictionary does not index.
     *
     * `閧の声` is 鬨の声, but the dictionary has no entry under 閧. The headword is asked again in its standard
     * spelling from [KANJI_VARIANTS], and the accepted entry reports that spelling as the base form.
     */
    private fun resolveKanjiVariant(
        token: PipelineToken,
        lookups: Map<String, DictionaryLookupDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        val base = kanjiVariantProbe(token) ?: return null
        val accepted = narrow(token, lookups[base], base, logGrading = logRescue) ?: return null
        if (logRescue) logger.info("Looked up variant kanji headword '{}' as '{}'", token.headword, base)
        return accepted
    }

    /** `閧` → `鬨`. Null when the headword has no variant kanji listed in [KANJI_VARIANTS]. */
    private fun kanjiVariantProbe(token: PipelineToken): String? {
        val variant = token.headword.map { KANJI_VARIANTS[it] ?: it }.joinToString("")
        return variant.takeIf { it != token.headword }
    }

    /** `交差する` → `交差`. Null unless the headword is something followed by する. */
    private fun suruVerbProbe(token: PipelineToken): String? =
        token.headword.takeIf { it.length > 2 && it.endsWith("する") }?.dropLast(2)

    /**
     * Safety net for a hiragana word the lyric stretches with ー instead of spelling the long vowel.
     *
     * Lyrics write ぎゅーぎゅー where the dictionary indexes ぎゅうぎゅう. Each ー becomes the vowel of
     * the kana before it (お-row as う) and the result is asked for.
     */
    private fun resolveLongVowelSpelling(
        token: PipelineToken,
        lookups: Map<String, DictionaryLookupDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        val base = longVowelProbe(token) ?: return null
        // The reading (ギューギュー) is spelled out the same way.
        val reading = spellOutLongVowels(JapaneseText.toHiragana(token.baseFormReading))?.let(JapaneseText::toKatakana)
        val accepted = narrow(token, lookups[base], base, reading, logRescue) ?: return null
        if (logRescue) logger.info("Spelled out long vowels of '{}' as '{}'", token.headword, base)
        return accepted
    }

    /** `ぎゅーぎゅー` → `ぎゅうぎゅう`. Null for a katakana-only headword, where ー is the normal spelling. */
    private fun longVowelProbe(token: PipelineToken): String? =
        token.headword.takeUnless { JapaneseText.isKatakanaOnly(it) }?.let(::spellOutLongVowels)

    /** Replaces every ー with the vowel of the kana before it. Null when there is no ー or no such vowel. */
    private fun spellOutLongVowels(text: String): String? {
        if ('ー' !in text) return null
        val spelled = StringBuilder()
        for (ch in text) {
            if (ch != 'ー') {
                spelled.append(ch)
                continue
            }
            val previous = spelled.lastOrNull() ?: return null
            spelled.append(LONG_VOWEL_BY_ROW.entries.firstOrNull { previous in it.key }?.value ?: return null)
        }
        return spelled.toString()
    }

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
        if (!reading.endsWith("ク") && !reading.endsWith("シ")) return null
        return reading.dropLast(1) + "イ"
    }

    private fun iAdjectiveProbe(token: PipelineToken): String? {
        if (token.headword.length >= 2 && token.headword.endsWith("し")) return token.headword.dropLast(1) + "い"
        if (!token.surface.endsWith("く") || token.surface.length < 2) return null
        if (token.headword.endsWith("い") && token.headword.length >= 2) return token.headword
        return token.surface.dropLast(1) + "い"
    }

    /**
     * What makes two candidate senses the same sense: everything a [PipelineSenseOption] carries
     * except the id. [provenance] is included because it decides whether sense-select is told the
     * entry's headword and reading.
     */
    private data class SenseIdentity(
        val baseForm: String,
        val headword: String?,
        val reading: String?,
        val english: String,
        val rawPos: List<String>,
        val provenance: DictionaryLookupProvenance,
    )

    private data class AcceptedLexicalEntry(
        val baseForm: String,
        val entries: List<DictionaryEntryDto>,
        val provenance: DictionaryLookupProvenance,
    )

    /**
     * Safety net for a kanji headword the dictionary does not spell that way.
     *
     * `燻む` comes back empty while `くすむ` finds it. The reading is asked instead and only an EXACT
     * grade is kept (a reading alone matches every homophone). The base form stays the lyric's headword.
     */
    private fun resolveReadingQuery(
        token: PipelineToken,
        lookups: Map<String, DictionaryLookupDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        val base = readingProbe(token) ?: return null
        val accepted = narrow(token, lookups[base], base, logGrading = logRescue) ?: return null
        if (accepted.provenance != DictionaryLookupProvenance.EXACT) return null
        if (logRescue) logger.info("Looked up kanji headword '{}' by its reading '{}'", token.headword, base)
        return accepted.copy(baseForm = token.headword)
    }

    /** The hiragana reading of a headword that is not kana-only. Null when there is no kana reading. */
    private fun readingProbe(token: PipelineToken): String? {
        if (JapaneseText.isKanaOnly(token.headword)) return null
        val reading = token.baseFormReading.takeIf { it.isNotBlank() && JapaneseText.isKanaOnly(it) } ?: return null
        return JapaneseText.toHiragana(reading)
    }

    /**
     * Safety net for a noun the lyric dresses with an honorific お / ご / 御 (御加減, おクスリ).
     *
     * The dictionary indexes only common prefixed forms, so the prefix is dropped and the remainder asked for
     * (in hiragana when katakana, as in [resolveHiraganaQuery]). Only noun and na-adjective senses are accepted.
     */
    private fun resolveHonorificPrefix(
        token: PipelineToken,
        lookups: Map<String, DictionaryLookupDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        val base = honorificPrefixProbe(token) ?: return null
        val accepted = narrow(token, lookups[base], base, honorificPrefixProbeReading(token), logRescue)
            ?: return null
        val nounEntries = accepted.entries.mapNotNull { entry ->
            val nounSenses = entry.senses.filter {
                DictionaryPartOfSpeechMapper.map(it.pos) in setOf(PartOfSpeech.NOUN, PartOfSpeech.NA_ADJECTIVE)
            }
            if (nounSenses.isEmpty()) null else entry.copy(senses = nounSenses)
        }
        if (nounEntries.isEmpty()) return null
        if (logRescue) logger.info("Stripped honorific prefix from '{}' to '{}'", token.headword, base)
        return AcceptedLexicalEntry(base, nounEntries, accepted.provenance)
    }

    /** `御加減` → `加減`, `おクスリ` → `くすり`. Null when there is no prefix or nothing follows it. */
    private fun honorificPrefixProbe(token: PipelineToken): String? {
        val prefix = HONORIFIC_PREFIXES.firstOrNull { token.headword.startsWith(it) } ?: return null
        val rest = token.headword.removePrefix(prefix).takeIf { it.isNotEmpty() } ?: return null
        return if (JapaneseText.isKatakanaOnly(rest)) JapaneseText.toHiragana(rest) else rest
    }

    /** The probed base form's reading: `ゴカゲン` → `カゲン`, mirroring [honorificPrefixProbe]. */
    private fun honorificPrefixProbeReading(token: PipelineToken): String? {
        val prefix = HONORIFIC_PREFIX_READINGS.firstOrNull { token.baseFormReading.startsWith(it) } ?: return null
        return token.baseFormReading.removePrefix(prefix).takeIf { it.isNotEmpty() }
    }

    /**
     * Safety net for a noun the lyric spells with its verb's continuative okurigana — 光り for 光.
     *
     * The trailing り is dropped from the headword only (光 itself reads ヒカリ, so the token's reading
     * already names the noun). Only noun senses are kept.
     */
    private fun resolveContinuativeNoun(
        token: PipelineToken,
        lookups: Map<String, DictionaryLookupDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        val base = continuativeNounProbe(token) ?: return null
        val accepted = narrow(token, lookups[base], base, logGrading = logRescue) ?: return null
        val nounEntries = accepted.entries.mapNotNull { entry ->
            val nounSenses = entry.senses.filter { DictionaryPartOfSpeechMapper.map(it.pos) == PartOfSpeech.NOUN }
            if (nounSenses.isEmpty()) null else entry.copy(senses = nounSenses)
        }
        if (nounEntries.isEmpty()) return null
        if (logRescue) logger.info("Looked up continuative spelling '{}' as noun '{}'", token.headword, base)
        return AcceptedLexicalEntry(base, nounEntries, accepted.provenance)
    }

    /** `光り` → `光`. Null unless the headword is something followed by り. */
    private fun continuativeNounProbe(token: PipelineToken): String? =
        token.headword.takeIf { it.length >= 2 && it.endsWith("り") }?.dropLast(1)

    /**
     * Safety net for when the segmentation LLM hands back a suru-verb's passive — 毒される,
     * 影響されない — as the headword instead of 毒する. Same guess as [resolveSuruDesiderative]:
     * 話される probes 話する, which no entry carries, so a godan passive stays unresolved.
     */
    private fun resolveSuruPassive(
        token: PipelineToken,
        lookups: Map<String, DictionaryLookupDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        val base = suruPassiveProbe(token) ?: return null
        val accepted = narrow(token, lookups[base], base, suruPassiveProbeReading(token), logRescue)
            ?: return null
        if (logRescue) logger.info("Normalized suru-verb passive '{}' to '{}'", token.surface, base)
        return accepted
    }

    /** The probed base form's reading: `ドクサレル` → `ドクスル`, mirroring [suruPassiveProbe]. */
    private fun suruPassiveProbeReading(token: PipelineToken): String? {
        val suffix = SURU_PASSIVE_READING_SUFFIXES.firstOrNull { token.baseFormReading.endsWith(it) }
            ?: return null
        val stem = token.baseFormReading.dropLast(suffix.length)
        return if (stem.isEmpty()) null else stem + "スル"
    }

    /** `毒される` / `毒されない` → `毒する`. Null when nothing precedes the suffix: される alone is する. */
    private fun suruPassiveProbe(token: PipelineToken): String? {
        val suffix = SURU_PASSIVE_SUFFIXES.firstOrNull { token.headword.endsWith(it) } ?: return null
        val stem = token.headword.dropLast(suffix.length)
        return if (stem.isEmpty()) null else stem + "する"
    }

    /**
     * Safety net for when the segmentation LLM hands back a passive — 呑み込まれる — as the headword
     * instead of 呑み込む. Tried only after the pair match has failed, so verbs the dictionary indexes itself
     * (生まれる, 忘れる) never reach it. The undone ending is a guess; only verb senses are accepted.
     */
    private fun resolvePassive(
        token: PipelineToken,
        lookups: Map<String, DictionaryLookupDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        val base = passiveProbe(token) ?: return null
        // The token's reading is the passive's (ノミコマレル), so undo it the same way as the headword.
        val reading = undoPassive(token.baseFormReading, PASSIVE_READING_ENDINGS)
        val accepted = narrow(token, lookups[base], base, reading, logRescue) ?: return null
        val verbEntries = accepted.entries.mapNotNull { entry ->
            val verbSenses = entry.senses.filter { DictionaryPartOfSpeechMapper.map(it.pos) == PartOfSpeech.VERB }
            if (verbSenses.isEmpty()) null else entry.copy(senses = verbSenses)
        }
        if (verbEntries.isEmpty()) return null
        if (logRescue) logger.info("Normalized passive '{}' to '{}'", token.headword, base)
        return AcceptedLexicalEntry(base, verbEntries, accepted.provenance)
    }

    /** `呑み込まれる` → `呑み込む`, `見られる` → `見る`. Null unless something precedes the ending. */
    private fun passiveProbe(token: PipelineToken): String? = undoPassive(token.headword, PASSIVE_ENDINGS)

    private fun undoPassive(text: String, endings: List<Pair<String, String>>): String? {
        val (ending, base) = endings.firstOrNull { text.endsWith(it.first) } ?: return null
        val stem = text.dropLast(ending.length)
        return if (stem.isEmpty()) null else stem + base
    }

    /**
     * Safety net for when the segmentation LLM hands back a stem with appearance そう — 泣きそう,
     * 忙しそう — as the headword instead of 泣く / 忙しい. Tried only after the pair match has already failed.
     *
     * The stem does not say its word class, so every restoration is asked for (stem + い, godan
     * u-row, stem + る); each keeps only the senses of the class it guessed.
     */
    private fun resolveAppearanceSou(
        token: PipelineToken,
        lookups: Map<String, DictionaryLookupDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        for (probe in appearanceSouProbes(token)) {
            val accepted = narrow(token, lookups[probe.baseForm], probe.baseForm, probe.reading, logRescue)
                ?: continue
            val matchingEntries = accepted.entries.mapNotNull { entry ->
                val senses = entry.senses.filter { DictionaryPartOfSpeechMapper.map(it.pos) == probe.partOfSpeech }
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
     * Safety net for a verb the lyric completes with きる / きれる (伝えきれぬ, 言いきれない).
     *
     * The suffix is dropped and the stem restored to its dictionary form. A stem does not say its
     * conjugation class (生き is 生きる, 書き is 書く), so both guesses are asked. Only verb senses are accepted.
     */
    private fun resolveCompletionSuffix(
        token: PipelineToken,
        lookups: Map<String, DictionaryLookupDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        for ((base, reading) in completionSuffixProbes(token)) {
            val accepted = narrow(token, lookups[base], base, reading, logRescue) ?: continue
            val verbEntries = accepted.entries.mapNotNull { entry ->
                val verbSenses = entry.senses.filter { DictionaryPartOfSpeechMapper.map(it.pos) == PartOfSpeech.VERB }
                if (verbSenses.isEmpty()) null else entry.copy(senses = verbSenses)
            }
            if (verbEntries.isEmpty()) continue
            if (logRescue) logger.info("Stripped completion suffix from '{}' to '{}'", token.headword, base)
            return AcceptedLexicalEntry(base, verbEntries, accepted.provenance)
        }
        return null
    }

    /**
     * `伝えきる` → `伝える` paired with its reading `ツタエル`; `書ききる` → `書きる` and `書く`. Empty
     * when the headword carries no completion suffix or nothing precedes it.
     */
    private fun completionSuffixProbes(token: PipelineToken): List<Pair<String, String?>> {
        val suffix = COMPLETION_SUFFIXES.firstOrNull { token.headword.endsWith(it) } ?: return emptyList()
        val stem = token.headword.dropLast(suffix.length).takeIf { it.isNotEmpty() } ?: return emptyList()
        val readingSuffix = COMPLETION_SUFFIXES.map(JapaneseText::toKatakana)
            .firstOrNull { token.baseFormReading.endsWith(it) }
        val readingStem = readingSuffix?.let { token.baseFormReading.dropLast(it.length) }?.takeIf { it.isNotEmpty() }

        val ichidan = (stem + "る") to readingStem?.let { it + "ル" }
        val godanEnding = GODAN_I_TO_U[stem.last()] ?: return listOf(ichidan)
        val godan = (stem.dropLast(1) + godanEnding) to
            readingStem?.let { it.dropLast(1) + JapaneseText.toKatakana(godanEnding.toString()) }
        return listOf(ichidan, godan)
    }

    /**
     * Safety net for a verb the lyric follows with a te-form auxiliary: motion ていく / てくる (飛んでいく),
     * progressive ている and its contraction てる (書いている, わかってる), completion てしまう.
     *
     * The auxiliary is dropped and the te-form conjugated back. んで / って are ambiguous (飛ぶ, 読む,
     * 死ぬ), so every candidate is asked and the first with a verb sense wins.
     */
    private fun resolveTeAuxiliary(
        token: PipelineToken,
        lookups: Map<String, DictionaryLookupDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        for ((base, reading) in teAuxiliaryProbes(token)) {
            val accepted = narrow(token, lookups[base], base, reading, logRescue) ?: continue
            val verbEntries = accepted.entries.mapNotNull { entry ->
                val verbSenses = entry.senses.filter { DictionaryPartOfSpeechMapper.map(it.pos) == PartOfSpeech.VERB }
                if (verbSenses.isEmpty()) null else entry.copy(senses = verbSenses)
            }
            if (verbEntries.isEmpty()) continue
            if (logRescue) logger.info("Stripped te-form auxiliary from '{}' to '{}'", token.headword, base)
            return AcceptedLexicalEntry(base, verbEntries, accepted.provenance)
        }
        return null
    }

    /**
     * `飛んでいく` / `トンデイク` → (`飛む`, `トム`), (`飛ぶ`, `トブ`), (`飛ぬ`, `トヌ`): every dictionary form
     * the te-form could come from, paired with its reading, then the same forms with a passive undone
     * (照らされている → 照らされる → 照らす). Empty unless the headword is a te-form followed by an auxiliary.
     */
    private fun teAuxiliaryProbes(token: PipelineToken): List<Pair<String, String?>> {
        val teForm = stripTeAuxiliary(token.headword) ?: return emptyList()
        val readings = stripTeAuxiliary(JapaneseText.toHiragana(token.baseFormReading))
            ?.let(::teFormToDictionaryForms)
            ?.map(JapaneseText::toKatakana)
        val forms = teFormToDictionaryForms(teForm).mapIndexed { i, base -> base to readings?.getOrNull(i) }
        val activeForms = forms.mapNotNull { (base, reading) ->
            undoPassive(base, PASSIVE_ENDINGS)?.let { it to reading?.let { r -> undoPassive(r, PASSIVE_READING_ENDINGS) } }
        }
        return forms + activeForms
    }

    /**
     * `飛んでいく` → `飛んで`, `わかってる` → `わかって`. Null unless what precedes the auxiliary ends in て / で,
     * so 来る and いる themselves are never cut.
     */
    private fun stripTeAuxiliary(text: String): String? = TE_AUX_SUFFIXES.firstNotNullOfOrNull { suffix ->
        text.takeIf { it.endsWith(suffix) }?.dropLast(suffix.length)
            ?.takeIf { it.length >= 2 && (it.endsWith("て") || it.endsWith("で")) }
    }

    /**
     * Safety net for a causative handed back as the headword — 振り向かせる, short 咲かす — instead of the
     * verb underneath. させる is a godan す-verb's (話させる) or any ichidan verb's (食べさせる), so both are asked.
     */
    private fun resolveCausative(
        token: PipelineToken,
        lookups: Map<String, DictionaryLookupDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? = resolveConjugation(token, causativeProbes(token), lookups, logRescue, "causative")

    /** `振り向かせる` → `振り向く`; `食べさせる` → `食べす`, `食べる`. Readings are inflected alike. */
    private fun causativeProbes(token: PipelineToken): List<ConjugationProbe> {
        val readingKana = JapaneseText.toHiragana(token.baseFormReading)
        return CAUSATIVE_ENDINGS
            .filter { (ending) -> token.headword.length > ending.length && token.headword.endsWith(ending) }
            .map { (ending, base, verbClass) ->
                val reading = readingKana.takeIf { it.endsWith(ending) }
                    ?.let { JapaneseText.toKatakana(it.dropLast(ending.length) + base) }
                ConjugationProbe(token.headword.dropLast(ending.length) + base, reading, verbClass)
            }
    }

    /**
     * Safety net for a verb's desiderative handed back as the headword — やりたい, 知りたがる, 生きたくない.
     * Tried after [resolveSuruDesiderative], which owns the stem + する reading of したい.
     *
     * An い-row stem is godan (やり → やる) or ichidan (生き → 生きる), so both are asked, each keeping only
     * the senses of its own class: 生く is an archaic yodan verb, not 生きる.
     */
    private fun resolveDesiderative(
        token: PipelineToken,
        lookups: Map<String, DictionaryLookupDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? = resolveConjugation(token, desiderativeProbes(token), lookups, logRescue, "desiderative")

    /** `やりたい` → `やる`, `やりる`; `見たい` → `見る`. Empty when only a lone kana precedes the suffix. */
    private fun desiderativeProbes(token: PipelineToken): List<ConjugationProbe> {
        val suffix = DESIDERATIVE_SUFFIXES.firstOrNull { token.headword.endsWith(it) } ?: return emptyList()
        val stem = token.headword.dropLast(suffix.length)
            .takeUnless { it.isEmpty() || (it.length == 1 && JapaneseText.isKanaOnly(it)) } ?: return emptyList()
        val readingStem = JapaneseText.toHiragana(token.baseFormReading)
            .takeIf { it.endsWith(suffix) }?.dropLast(suffix.length)?.takeIf { it.isNotEmpty() }

        val ichidan = ConjugationProbe(stem + "る", readingStem?.let { JapaneseText.toKatakana(it + "る") }, ICHIDAN)
        val godanEnding = GODAN_I_TO_U[stem.last()] ?: return listOf(ichidan)
        val godanReading = readingStem?.let { r ->
            GODAN_I_TO_U[r.last()]?.let { JapaneseText.toKatakana(r.dropLast(1) + it) }
        }
        return listOf(ConjugationProbe(stem.dropLast(1) + godanEnding, godanReading, GODAN), ichidan)
    }

    /** Safety net for an ichidan verb's volitional handed back as the headword — 化けよう for 化ける. */
    private fun resolveIchidanVolitional(
        token: PipelineToken,
        lookups: Map<String, DictionaryLookupDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        val base = ichidanVolitionalProbe(token) ?: return null
        val reading = token.baseFormReading.takeIf { it.endsWith("ヨウ") }?.dropLast(2)?.plus("ル")
        return resolveConjugation(token, listOf(ConjugationProbe(base, reading, ICHIDAN)), lookups, logRescue, "volitional")
    }

    /** `化けよう` → `化ける`. Null unless something precedes よう. */
    private fun ichidanVolitionalProbe(token: PipelineToken): String? =
        token.headword.takeIf { it.length > 2 && it.endsWith("よう") }?.dropLast(2)?.plus("る")

    /** The first probe the dictionary answers with senses of the conjugation class that probe guessed. */
    private fun resolveConjugation(
        token: PipelineToken,
        probes: List<ConjugationProbe>,
        lookups: Map<String, DictionaryLookupDto>,
        logRescue: Boolean,
        form: String,
    ): AcceptedLexicalEntry? {
        for (probe in probes) {
            val accepted = narrow(token, lookups[probe.baseForm], probe.baseForm, probe.reading, logRescue) ?: continue
            val classEntries = accepted.entries.mapNotNull { entry ->
                val senses = entry.senses.filter { sense -> sense.pos.any { probe.verbClass in it.lowercase() } }
                if (senses.isEmpty()) null else entry.copy(senses = senses)
            }
            if (classEntries.isEmpty()) continue
            if (logRescue) logger.info("Normalized {} '{}' to '{}'", form, token.headword, probe.baseForm)
            return AcceptedLexicalEntry(probe.baseForm, classEntries, accepted.provenance)
        }
        return null
    }

    /** [verbClass] is the lowercase dictionary POS label the restored form must carry, e.g. "godan verb". */
    private data class ConjugationProbe(
        val baseForm: String,
        val reading: String?,
        val verbClass: String,
    )

    /**
     * Safety net for when the segmentation LLM hands back a verb's negative — いらない for いらん —
     * as the headword instead of 要る. Tried only after the pair match has already failed.
     *
     * The probe guesses the conjugation (少ない asks for 少る), so only verb senses are kept.
     */
    private fun resolveNegativeVerb(
        token: PipelineToken,
        lookups: Map<String, DictionaryLookupDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        val base = negativeVerbProbe(token.headword) ?: return null
        // The token's reading is イラナイ, the wrong headword's, so it is inflected back to イル too.
        val reading = negativeVerbProbe(JapaneseText.toHiragana(token.baseFormReading))?.let(JapaneseText::toKatakana)
        val accepted = narrow(token, lookups[base], base, reading, logRescue) ?: return null
        val verbEntries = accepted.entries.mapNotNull { entry ->
            val verbSenses = entry.senses.filter { DictionaryPartOfSpeechMapper.map(it.pos) == PartOfSpeech.VERB }
            if (verbSenses.isEmpty()) null else entry.copy(senses = verbSenses)
        }
        if (verbEntries.isEmpty()) return null
        if (logRescue) logger.info("Normalized negative verb '{}' to '{}'", token.headword, base)
        return AcceptedLexicalEntry(base, verbEntries, accepted.provenance)
    }

    /**
     * `いらない` → `いる`, `書かない` → `書く`, `見ない` → `見る`. A stem ending in an a-row kana is
     * godan and shifts to the u-row; anything else is read as ichidan. Null when nothing precedes ない.
     */
    private fun negativeVerbProbe(form: String): String? {
        val stem = form.takeIf { it.endsWith("ない") }?.dropLast(2)?.takeIf { it.isNotEmpty() } ?: return null
        val godanEnding = NEGATIVE_GODAN_ENDINGS[stem.last()] ?: return stem + "る"
        return stem.dropLast(1) + godanEnding
    }

    /**
     * Safety net for a godan verb's potential form handed back as the headword — 掴める for 掴む.
     *
     * The え-row + る ending is turned back into the う-row dictionary form. Only godan verb senses
     * are accepted: a missed ichidan verb (見える) probes a non-word.
     */
    private fun resolvePotentialForm(
        token: PipelineToken,
        lookups: Map<String, DictionaryLookupDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        val base = potentialFormProbe(token) ?: return null
        // The token's reading is the potential's (ツカメル), so it is inflected back the same way.
        val reading = potentialFormReading(token.baseFormReading)
        val accepted = narrow(token, lookups[base], base, reading, logRescue) ?: return null
        val godanEntries = accepted.entries.mapNotNull { entry ->
            val godanSenses = entry.senses.filter { sense -> sense.pos.any { "godan verb" in it.lowercase() } }
            if (godanSenses.isEmpty()) null else entry.copy(senses = godanSenses)
        }
        if (godanEntries.isEmpty()) return null
        if (logRescue) logger.info("Looked up potential form '{}' as '{}'", token.headword, base)
        return AcceptedLexicalEntry(base, godanEntries, accepted.provenance)
    }

    /**
     * The dictionary lists some potential verbs as headwords of their own (眠れる: "to be able to sleep"), so
     * the exact hit never reaches [resolvePotentialForm] and the card teaches "can sleep" instead of 眠る.
     * Only entries whose every verb sense is "to be able to …" are sent back: 行ける also means "to be good".
     */
    private fun isPotentialVerbEntry(accepted: AcceptedLexicalEntry): Boolean {
        val verbSenses = accepted.entries.flatMap { it.senses }
            .filter { DictionaryPartOfSpeechMapper.map(it.pos) == PartOfSpeech.VERB }
        return verbSenses.isNotEmpty() && verbSenses.all { it.english.startsWith("to be able to") }
    }

    /** `掴める` → `掴む`. Null unless the headword carries kanji and ends in an え-row kana + る. */
    private fun potentialFormProbe(token: PipelineToken): String? {
        val headword = token.headword
        if (headword.length < 3 || JapaneseText.isKanaOnly(headword) || !headword.endsWith("る")) return null
        val uRow = POTENTIAL_TO_DICTIONARY[headword[headword.length - 2]] ?: return null
        return headword.dropLast(2) + uRow
    }

    /** `ツカメル` → `ツカム`, mirroring [potentialFormProbe]. */
    private fun potentialFormReading(reading: String): String? {
        if (reading.length < 3 || !reading.endsWith("ル")) return null
        val eRow = JapaneseText.toHiragana(reading[reading.length - 2].toString()).single()
        val uRow = POTENTIAL_TO_DICTIONARY[eRow] ?: return null
        return reading.dropLast(2) + JapaneseText.toKatakana(uRow.toString())
    }

    /**
     * Safety net for when the segmentation LLM hands back a godan verb's renyokei — 悼み — as the
     * headword instead of 悼む. Tried last: a renyokei noun the dictionary indexes itself (悲しみ)
     * already matched in the first pass. Only verb senses are accepted (the probe is a guess).
     */
    private fun resolveGodanRenyokei(
        token: PipelineToken,
        lookups: Map<String, DictionaryLookupDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        val base = godanRenyokeiProbe(token) ?: return null
        // The token's reading is the renyokei's (イタミ), so restore it the same way (イタム).
        val reading = token.baseFormReading.lastOrNull()
            ?.let { GODAN_I_TO_U[JapaneseText.toHiragana(it.toString()).single()] }
            ?.let { token.baseFormReading.dropLast(1) + JapaneseText.toKatakana(it.toString()) }
        val accepted = narrow(token, lookups[base], base, reading, logRescue) ?: return null
        val verbEntries = accepted.entries.mapNotNull { entry ->
            val verbSenses = entry.senses.filter { DictionaryPartOfSpeechMapper.map(it.pos) == PartOfSpeech.VERB }
            if (verbSenses.isEmpty()) null else entry.copy(senses = verbSenses)
        }
        if (verbEntries.isEmpty()) return null
        if (logRescue) logger.info("Restored godan renyokei '{}' to '{}'", token.headword, base)
        return AcceptedLexicalEntry(base, verbEntries, accepted.provenance)
    }

    /** `悼み` → `悼む`. Null unless the headword ends in an い-row kana with something before it. */
    private fun godanRenyokeiProbe(token: PipelineToken): String? {
        if (token.headword.length < 2) return null
        val ending = GODAN_I_TO_U[token.headword.last()] ?: return null
        return token.headword.dropLast(1) + ending
    }

    /**
     * Safety net for a godan verb's potential negative handed back as the headword — `飛べない` for 飛ぶ.
     *
     * The e-row stem is turned back into the u-row dictionary form and only verb senses are kept.
     */
    private fun resolvePotentialNegative(
        token: PipelineToken,
        lookups: Map<String, DictionaryLookupDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        val base = potentialNegativeProbe(token) ?: return null
        // The token's reading is トベナイ, the wrong headword's, so it is inflected back to トブ too.
        val reading = potentialNegativeBase(JapaneseText.toHiragana(token.baseFormReading))
            ?.let(JapaneseText::toKatakana)
        val accepted = narrow(token, lookups[base], base, reading, logRescue) ?: return null
        val verbEntries = accepted.entries.mapNotNull { entry ->
            val verbSenses = entry.senses.filter { DictionaryPartOfSpeechMapper.map(it.pos) == PartOfSpeech.VERB }
            if (verbSenses.isEmpty()) null else entry.copy(senses = verbSenses)
        }
        if (verbEntries.isEmpty()) return null
        if (logRescue) logger.info("Normalized potential negative '{}' to '{}'", token.headword, base)
        return AcceptedLexicalEntry(base, verbEntries, accepted.provenance)
    }

    /** `飛べない` → `飛ぶ`. Null unless something ending in an e-row kana precedes ない. */
    private fun potentialNegativeProbe(token: PipelineToken): String? = potentialNegativeBase(token.headword)

    private fun potentialNegativeBase(text: String): String? {
        val stem = text.takeIf { it.endsWith("ない") }?.dropLast(2) ?: return null
        if (stem.length < 2) return null
        val u = POTENTIAL_TO_DICTIONARY[stem.last()] ?: return null
        return stem.dropLast(1) + u
    }

    /**
     * Safety net for a na-adjective handed back in its attributive form — 嫌な, 新たな — instead of the stem.
     *
     * Only a word that is a na-adjective somewhere takes な, so a plain noun homophone of the stem (矢 for
     * やな) is not adopted. The entry's noun and na-adjective senses are kept.
     */
    private fun resolveNaAdjectiveAttributive(
        token: PipelineToken,
        lookups: Map<String, DictionaryLookupDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        val base = naAdjectiveAttributiveProbe(token) ?: return null
        val reading = token.baseFormReading.takeIf { it.endsWith("ナ") || it.endsWith("ダ") }?.dropLast(1)
        val accepted = narrow(token, lookups[base], base, reading, logRescue) ?: return null
        val naAdjectiveEntries = accepted.entries
            .filter { entry -> entry.senses.any { DictionaryPartOfSpeechMapper.map(it.pos) == PartOfSpeech.NA_ADJECTIVE } }
            .mapNotNull { entry ->
                val senses = entry.senses.filter {
                    DictionaryPartOfSpeechMapper.map(it.pos) in setOf(PartOfSpeech.NOUN, PartOfSpeech.NA_ADJECTIVE)
                }
                if (senses.isEmpty()) null else entry.copy(senses = senses)
            }
        if (naAdjectiveEntries.isEmpty()) return null
        if (logRescue) logger.info("Normalized na-adjective attributive '{}' to '{}'", token.headword, base)
        return AcceptedLexicalEntry(base, naAdjectiveEntries, accepted.provenance)
    }

    /** `嫌な` → `嫌`; the dictionary form `幼気だ` → `幼気` too. Null unless something precedes な/だ. */
    private fun naAdjectiveAttributiveProbe(token: PipelineToken): String? =
        token.headword.takeIf { it.length >= 2 && (it.endsWith("な") || it.endsWith("だ")) }?.dropLast(1)

    /** Safety net for an interjection the lyric cuts short with a trailing っ (えいっ); only interjection senses are kept. */
    private fun resolveCutShortInterjection(
        token: PipelineToken,
        lookups: Map<String, DictionaryLookupDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        val base = cutShortInterjectionProbe(token) ?: return null
        val reading = token.baseFormReading.takeIf { it.length >= 2 && it.endsWith("ッ") }?.dropLast(1)
        val accepted = narrow(token, lookups[base], base, reading, logRescue) ?: return null
        val interjectionEntries = accepted.entries.mapNotNull { entry ->
            val senses = entry.senses.filter { DictionaryPartOfSpeechMapper.map(it.pos) == PartOfSpeech.INTERJECTION }
            if (senses.isEmpty()) null else entry.copy(senses = senses)
        }
        if (interjectionEntries.isEmpty()) return null
        if (logRescue) logger.info("Stripped trailing small tsu from '{}' to '{}'", token.headword, base)
        return AcceptedLexicalEntry(base, interjectionEntries, accepted.provenance)
    }

    /** `えいっ` → `えい`. Null unless something precedes a trailing っ / ッ. */
    private fun cutShortInterjectionProbe(token: PipelineToken): String? =
        token.headword.takeIf { it.length >= 2 && (it.endsWith("っ") || it.endsWith("ッ")) }?.dropLast(1)

    /**
     * Safety net for a kanji numeral glued to its counter — 二年, 何回目 — which the dictionary has no entry for.
     *
     * The numeral is dropped and the counter looked up. Its reading is the entry reading that ends the token's
     * (ニネン ends in ネン, not トシ). Only noun and counter senses are kept.
     */
    private fun resolveNumeralCounter(
        token: PipelineToken,
        lookups: Map<String, DictionaryLookupDto>,
        logRescue: Boolean = true,
    ): AcceptedLexicalEntry? {
        val base = numeralCounterProbe(token) ?: return null
        val lookup = lookups[base]
        val reading = lookup?.entries?.mapNotNull { it.reading }
            ?.filter { it.length < token.baseFormReading.length && token.baseFormReading.endsWith(it) }
            ?.maxByOrNull { it.length }
        val accepted = narrow(token, lookup, base, reading, logRescue) ?: return null
        val counterEntries = accepted.entries.mapNotNull { entry ->
            val senses = entry.senses.filter {
                DictionaryPartOfSpeechMapper.map(it.pos) in setOf(PartOfSpeech.NOUN, PartOfSpeech.SUFFIX)
            }
            if (senses.isEmpty()) null else entry.copy(senses = senses)
        }
        if (counterEntries.isEmpty()) return null
        if (logRescue) logger.info("Looked up numeral compound '{}' as counter '{}'", token.headword, base)
        return AcceptedLexicalEntry(base, counterEntries, accepted.provenance)
    }

    /** `二年` → `年`, `何回目` → `回目`. Null unless kanji numerals are followed by something that is not kana. */
    private fun numeralCounterProbe(token: PipelineToken): String? {
        val counter = token.headword.dropWhile { it in NUMERAL_KANJI }
        if (counter.isEmpty() || counter.length == token.headword.length) return null
        return counter.takeUnless { JapaneseText.isKanaOnly(it.take(1)) }
    }

    /**
     * True for a kana headword ending in ない that matched only kanji-spelled entries through their reading:
     * いない reaches 以内, while the lyric almost always means the negative of いる. Only noun matches count:
     * はかない, あぶない, つまらない are adjectives the dictionary spells in kanji, not negatives of はく, あぶる, 詰まる.
     */
    private fun isKanaHomophoneOnly(token: PipelineToken, accepted: AcceptedLexicalEntry): Boolean =
        JapaneseText.isKanaOnly(token.headword) && token.headword.endsWith("ない") &&
            accepted.entries.all { it.headword != null && it.headword != token.headword } &&
            accepted.entries.flatMap { it.senses }.all { DictionaryPartOfSpeechMapper.map(it.pos) == PartOfSpeech.NOUN }

    private fun withStandardKanji(token: PipelineToken): PipelineToken =
        token.copy(headword = JapaneseText.withStandardKanji(token.headword))

    private companion object {
        val GLUED_PARTICLE_ENDINGS = setOf('に', 'で', 'を', 'が', 'は', 'も', 'と', 'の', 'へ')

        val INTENSIFIER_PREFIXES = listOf("ぶち", "ぶっ")

        /** Hiragana grouped by vowel, and the kana a following ー is spelled as. */
        val LONG_VOWEL_BY_ROW = mapOf(
            "あぁかがさざただなはばぱまやゃらわ" to 'あ',
            "いぃきぎしじちぢにひびぴみり" to 'い',
            "うぅくぐすずつづぬふぶぷむゆゅる" to 'う',
            "えぇけげせぜてでねへべぺめれ" to 'え',
            "おぉこごそぞとどのほぼぽもよょろを" to 'う',
        )

        /** Variant kanji the dictionary does not index → the standard spelling it does. Add pairs as misses appear. */
        val KANJI_VARIANTS = mapOf('閧' to '鬨', '赦' to '許', '堕' to '落', '搔' to '掻')

        /** Longest first, so したくない is not read as したい with a stem ending in く. */
        val SURU_DESIDERATIVE_SUFFIXES = listOf("したくない", "したい")
        val SURU_DESIDERATIVE_READING_SUFFIXES = listOf("シタクナイ", "シタイ")

        val HONORIFIC_PREFIXES = listOf("お", "ご", "御")
        val HONORIFIC_PREFIX_READINGS = listOf("オ", "ゴ")

        val SURU_PASSIVE_SUFFIXES = listOf("されない", "される")
        val SURU_PASSIVE_READING_SUFFIXES = listOf("サレナイ", "サレル")

        /** Passive ending → dictionary-form ending: godan `〜あれる` → `〜う`, ichidan `〜られる` → `〜る`. */
        val PASSIVE_ENDINGS = listOf(
            "われる" to "う", "かれる" to "く", "がれる" to "ぐ", "される" to "す", "たれる" to "つ",
            "なれる" to "ぬ", "ばれる" to "ぶ", "まれる" to "む", "られる" to "る",
        )
        val PASSIVE_READING_ENDINGS = PASSIVE_ENDINGS.map { (ending, base) ->
            JapaneseText.toKatakana(ending) to JapaneseText.toKatakana(base)
        }

        /** A godan verb's masu-stem / renyokei kana (泣き) to its dictionary-form kana (泣く). */
        val GODAN_I_TO_U = mapOf(
            'い' to 'う', 'き' to 'く', 'ぎ' to 'ぐ', 'し' to 'す', 'ち' to 'つ',
            'に' to 'ぬ', 'び' to 'ぶ', 'み' to 'む', 'り' to 'る',
        )

        /** Longest first among overlapping spellings, so きれない is never cut as a shorter suffix. */
        val COMPLETION_SUFFIXES = listOf("きれない", "きれる", "きれず", "きれぬ", "きる")

        /** Every suffix is tried, so いる is cut before the bare る of the contraction てる. */
        val TE_AUX_SUFFIXES = listOf("いく", "行く", "くる", "来る", "いる", "居る", "しまう", "る")

        const val GODAN = "godan verb"
        const val ICHIDAN = "ichidan verb"

        /** Causative ending → restored dictionary-form ending and the conjugation class that restores it. */
        val CAUSATIVE_ENDINGS = listOf(
            Triple("かせる", "く", GODAN), Triple("がせる", "ぐ", GODAN), Triple("させる", "す", GODAN),
            Triple("させる", "る", ICHIDAN), Triple("たせる", "つ", GODAN), Triple("なせる", "ぬ", GODAN),
            Triple("ばせる", "ぶ", GODAN), Triple("ませる", "む", GODAN), Triple("らせる", "る", GODAN),
            Triple("わせる", "う", GODAN),
            Triple("かす", "く", GODAN), Triple("がす", "ぐ", GODAN), Triple("たす", "つ", GODAN),
            Triple("ばす", "ぶ", GODAN), Triple("ます", "む", GODAN), Triple("らす", "る", GODAN),
            Triple("わす", "う", GODAN),
        )

        val DESIDERATIVE_SUFFIXES = listOf("たくない", "たがる", "たい")

        const val NUMERAL_KANJI = "〇零一二三四五六七八九十百千万億兆何数幾"


        /** Te-form ending → the dictionary-form endings it can come from. */
        val TE_FORM_ENDINGS = listOf(
            "んで" to listOf("む", "ぶ", "ぬ"),
            "って" to listOf("う", "つ", "る"),
            "いて" to listOf("く"),
            "いで" to listOf("ぐ"),
            "して" to listOf("す"),
        )

        /**
         * `飛んで` → `飛む`, `飛ぶ`, `飛ぬ`; `消えて` → `消える`. Godan candidates first, the ichidan
         * reading of て last. The order is fixed so a headword and its reading line up index by index.
         */
        fun teFormToDictionaryForms(teForm: String): List<String> {
            val godan = TE_FORM_ENDINGS.firstOrNull { teForm.endsWith(it.first) }
                ?.let { (ending, bases) -> bases.map { teForm.dropLast(ending.length) + it } }
                ?: emptyList()
            val ichidan = if (teForm.endsWith("て")) listOf(teForm.dropLast(1) + "る") else emptyList()
            return (godan + ichidan).filter { it.length >= 2 }
        }

        /** Godan negative stem ending → dictionary-form ending: 要ら(ない) → 要る, 会わ(ない) → 会う. */
        val NEGATIVE_GODAN_ENDINGS = mapOf(
            'か' to "く", 'が' to "ぐ", 'さ' to "す", 'た' to "つ", 'な' to "ぬ",
            'ば' to "ぶ", 'ま' to "む", 'ら' to "る", 'わ' to "う",
        )

        /** The potential's え-row kana before る, mapped to the godan dictionary form's う-row ending. */
        val POTENTIAL_TO_DICTIONARY = mapOf(
            'え' to 'う', 'け' to 'く', 'げ' to 'ぐ', 'せ' to 'す', 'て' to 'つ',
            'ね' to 'ぬ', 'べ' to 'ぶ', 'め' to 'む', 'れ' to 'る',
        )
    }
}
