package com.japanese.vocabulary.translation.service.pipeline

import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.translation.client.dictionary.DictionaryPartOfSpeechMapper
import com.japanese.vocabulary.translation.client.dictionary.dto.DictionaryLookupDto
import com.japanese.vocabulary.translation.client.dictionary.dto.DictionaryLookupProvenance
import com.japanese.vocabulary.translation.model.PipelineToken
import com.japanese.vocabulary.translation.service.DictionaryService
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

/**
 * Joins a compound verb the segmentation model split in two back into one token.
 *
 * `握り返せ` comes back as 握り(握る) + 返せ(返す): the card then teaches "grasp" and "return" and loses
 * "squeeze back". A pair is joined only when the dictionary has the compound as a verb, so two verbs that
 * merely follow each other stay two words.
 *
 * Also joins two adjacent tokens that carry the same headword (黄昏 + る, both 黄昏る): the model split one
 * word's surface and the second half alone would teach nothing.
 */
@Component
class CompoundVerbMerger(
    private val dictionaryService: DictionaryService,
) {
    private val logger = LoggerFactory.getLogger(CompoundVerbMerger::class.java)

    suspend fun merge(tokensByIndex: Map<Int, List<PipelineToken>>): Map<Int, List<PipelineToken>> {
        val adjacent = tokensByIndex.values.flatMap { it.zipWithNext() }
        val pairs = adjacent.filter { (first, second) -> isCompoundCandidate(first, second) }
        if (pairs.isEmpty() && adjacent.none(::isSplitWord)) return tokensByIndex
        val lookups = if (pairs.isEmpty()) {
            emptyMap()
        } else {
            dictionaryService.lookupAll(pairs.flatMap { (first, second) -> queries(first, second) })
        }

        return tokensByIndex.mapValues { (_, tokens) ->
            val merged = mutableListOf<PipelineToken>()
            for (token in tokens) {
                val previous = merged.lastOrNull()
                val compound = previous?.let { joined(it, token, lookups) }
                if (compound != null) {
                    logger.info("Joined '{}' + '{}' into '{}'", previous.surface, token.surface, compound.headword)
                    merged[merged.lastIndex] = compound
                } else {
                    merged += token
                }
            }
            merged
        }
    }

    private fun joined(first: PipelineToken, second: PipelineToken, lookups: Map<String, DictionaryLookupDto>): PipelineToken? {
        if (isSplitWord(first to second)) return join(first, second, first.headword, first.baseFormReading)
        if (!isCompoundCandidate(first, second)) return null
        val (spelled, byReading) = queries(first, second)
        val headword = verbHeadword(lookups[spelled]) { it == spelled }
            ?: verbHeadword(lookups[byReading]) { it.startsWith(first.surface) }
            ?: return null
        return join(first, second, headword, first.usedReading + second.baseFormReading)
    }

    private fun join(first: PipelineToken, second: PipelineToken, headword: String, baseFormReading: String) =
        PipelineToken(
            lineIndex = first.lineIndex,
            surface = first.surface + second.surface,
            headword = headword,
            charStart = first.charStart,
            charEnd = second.charEnd,
            usedReading = first.usedReading + second.usedReading,
            baseFormReading = baseFormReading,
            contextGloss = second.contextGloss,
        )

    /** The compound's spelling the dictionary should index (`握り返す`) and its reading in hiragana (`まざりあう`). */
    private fun queries(first: PipelineToken, second: PipelineToken): List<String> = listOf(
        first.surface + second.headword,
        JapaneseText.toHiragana(first.usedReading + second.baseFormReading),
    )

    /** The spelling of a verb entry [lookup] holds under a headword [accepts], or null. */
    private fun verbHeadword(lookup: DictionaryLookupDto?, accepts: (String) -> Boolean): String? {
        if (lookup == null || lookup.provenance != DictionaryLookupProvenance.EXACT) return null
        return lookup.entries.firstOrNull { entry ->
            entry.headword?.let(accepts) == true &&
                entry.senses.any { DictionaryPartOfSpeechMapper.map(it.pos) == PartOfSpeech.VERB }
        }?.headword
    }

    /**
     * The first token is a verb's continuative stem right before a second verb: godan 握り for 握る (last kana
     * moved to the い row) or ichidan 分け for 分ける (る dropped). An え-row godan form (立て) is an imperative.
     */
    private fun isCompoundCandidate(first: PipelineToken, second: PipelineToken): Boolean {
        if (first.charEnd != second.charStart || first.headword == second.headword) return false
        if (first.surface == first.headword || first.surface.length < 2 || second.headword.length < 2) return false
        if (first.usedReading.isBlank() || second.baseFormReading.isBlank()) return false
        if (second.headword.last() !in VERB_ENDINGS || first.headword.last() !in VERB_ENDINGS) return false
        val ichidanStem = first.headword == first.surface + "る"
        val godanStem = first.headword.dropLast(1) == first.surface.dropLast(1) &&
            GODAN_CONTINUATIVE[first.surface.last()] == first.headword.last()
        return ichidanStem || godanStem
    }

    /** Two halves of one word, not a repeat: 好き好き is two tokens of 好き on purpose. */
    private fun isSplitWord(pair: Pair<PipelineToken, PipelineToken>): Boolean {
        val (first, second) = pair
        return first.charEnd == second.charStart && first.headword == second.headword &&
            first.surface != second.surface && JapaneseText.containsJapanese(first.headword)
    }

    private companion object {
        val VERB_ENDINGS = setOf('う', 'く', 'ぐ', 'す', 'つ', 'ぬ', 'ぶ', 'む', 'る')
        val GODAN_CONTINUATIVE = mapOf(
            'い' to 'う', 'き' to 'く', 'ぎ' to 'ぐ', 'し' to 'す', 'ち' to 'つ',
            'に' to 'ぬ', 'び' to 'ぶ', 'み' to 'む', 'り' to 'る',
        )
    }
}
