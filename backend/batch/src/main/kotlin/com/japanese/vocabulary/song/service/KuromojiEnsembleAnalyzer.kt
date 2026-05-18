package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.song.dto.PartOfSpeech
import com.japanese.vocabulary.song.dto.TokenInfo

/**
 * Ensemble morphological analyzer combining Kuromoji with IPADic and UniDic dictionaries.
 *
 * WHY TWO DICTIONARIES:
 * - IPADic (2007): Stable segmentation for common words, but misses colloquial forms
 *   (e.g., うるせえ→fragments, いい→いう baseForm error)
 * - UniDic: Handles colloquial forms well (うるせえ→うるさい), but over-segments
 *   compounds (どうか→どう+か, だから→だ+から)
 * They complement each other's weaknesses.
 *
 * WHY LEAST-SPLIT:
 * At each character position, picks the longer token from either analyzer.
 * This prevents UniDic's over-segmentation (どうか stays as one token from IPADic)
 * while allowing UniDic's better handling of colloquial forms (うるせえ as one token).
 *
 * AUXILIARY VERB EXCEPTION:
 * When the shorter segmentation contains AUXILIARY_VERB within the longer token's span,
 * prefer the split version. This separates verb+auxiliary combinations (e.g., 言える→言え+る)
 * to avoid creating unnecessary verb variants as flashcards.
 *
 * KNOWN LIMITATION:
 * Least-split can incorrectly merge tokens. Example: 好きになるほど
 * IPADic produces なるほど (one token, "indeed") instead of なる+ほど ("become" + "to the extent").
 * Least-split picks the merged version since it's longer. This changes the meaning entirely.
 * These cases require user editing — no automated strategy can reliably resolve them.
 *
 * FALLBACK: When both analyzers produce the same span length at a position, UniDic is preferred.
 */
class KuromojiEnsembleAnalyzer(
    private val ipadic: KuromojiMorphologicalAnalyzer,
    private val unidic: KuromojiUnidicMorphologicalAnalyzer
) : MorphologicalAnalyzer {

    override fun analyze(text: String): List<TokenInfo> {
        val ipadicTokens = normalizePositions(ipadic.analyze(text), text)
        val unidicTokens = normalizePositions(unidic.analyze(text), text)
        return leastSplit(ipadicTokens, unidicTokens, text)
    }

    /**
     * Re-calculates charStart/charEnd by finding each token's surface in the original text.
     *
     * WHY: Different analyzers handle whitespace differently — some include spaces as tokens,
     * others skip them. This causes charStart offsets to diverge for the same word.
     * Normalizing by sequential indexOf ensures consistent positions across analyzers.
     */
    private fun normalizePositions(tokens: List<TokenInfo>, text: String): List<TokenInfo> {
        var searchFrom = 0
        return tokens.map { token ->
            val idx = text.indexOf(token.surface, searchFrom)
            if (idx == -1) return@map token
            val normalized = token.copy(charStart = idx, charEnd = idx + token.surface.length)
            searchFrom = normalized.charEnd
            normalized
        }
    }

    /**
     * Least-split ensemble: at each character position, pick the longer token.
     * Exception: prefer the shorter split when the other analyzer's tokens within
     * the longer span contain AUXILIARY_VERB (to separate verb+auxiliary combinations).
     * Tie-break: prefer UniDic (better OOV/colloquial handling).
     */
    private fun leastSplit(
        ipadicTokens: List<TokenInfo>,
        unidicTokens: List<TokenInfo>,
        text: String
    ): List<TokenInfo> {
        val ipadicMap = ipadicTokens.associateBy { it.charStart }
        val unidicMap = unidicTokens.associateBy { it.charStart }

        val result = mutableListOf<TokenInfo>()
        var pos = 0
        val maxEnd = text.length

        while (pos < maxEnd) {
            val iToken = ipadicMap[pos]
            val uToken = unidicMap[pos]

            val winner = when {
                iToken == null && uToken == null -> { pos++; continue }
                iToken == null -> uToken!!
                uToken == null -> iToken
                else -> {
                    val iSpan = iToken.charEnd - iToken.charStart
                    val uSpan = uToken.charEnd - uToken.charStart
                    when {
                        iSpan > uSpan && hasAuxiliaryVerbInSpan(unidicMap, uToken.charEnd, iToken.charEnd) -> uToken
                        uSpan > iSpan && hasAuxiliaryVerbInSpan(ipadicMap, iToken.charEnd, uToken.charEnd) -> iToken
                        // Default: prefer longer span; on tie, prefer UniDic
                        iSpan > uSpan -> iToken
                        else -> uToken
                    }
                }
            }

            result.add(winner)
            pos = winner.charEnd
        }

        return result
    }

    private fun hasAuxiliaryVerbInSpan(tokenMap: Map<Int, TokenInfo>, from: Int, to: Int): Boolean {
        var pos = from
        while (pos < to) {
            val token = tokenMap[pos] ?: return false
            if (token.partOfSpeech == PartOfSpeech.AUXILIARY_VERB) return true
            pos = token.charEnd
        }
        return false
    }
}
