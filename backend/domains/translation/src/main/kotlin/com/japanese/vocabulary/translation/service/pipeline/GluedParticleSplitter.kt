package com.japanese.vocabulary.translation.service.pipeline

import com.japanese.vocabulary.translation.client.jisho.dto.JishoEntryDto
import com.japanese.vocabulary.translation.client.jisho.dto.JishoLookupProvenance
import com.japanese.vocabulary.translation.model.PipelineToken
import com.japanese.vocabulary.translation.model.PipelineTokenKey
import com.japanese.vocabulary.translation.service.JishoService
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

/**
 * Splits a particle the segmentation model glued onto the word in front of it.
 *
 * The prompt already asks for particles as their own words, but nothing enforced it, so `幸せがある`
 * came back as `幸せ` + `がある`: the headword (`ある`) was right, the *surface* carried the particle,
 * and the reading `ガアル` reached the app as one word — displayed as 가아루.
 *
 * **The evidence is the model's own output, not a guess.** A split only fires when the two fields it
 * returned contradict each other: the surface is the headword plus one particle character (`何を`
 * with headword `何`), or the surface opens with a particle the headword does not (`がある` with
 * headword `ある`). Both mean the model said "this word's dictionary form is the surface minus this
 * particle" — so the particle does not belong to the word.
 *
 * Everything else is left alone, because the two failures are not worth the same. Leaving a glued
 * token whole keeps the meaning the headword already earned and only mis-renders the surface and its
 * reading; splitting a word that was never glued destroys a real dictionary entry. So the checks below
 * are all "leave it alone unless": the dictionary knows the glued form, the reading does not line up,
 * or jisho could not be reached — any of those and the token passes through untouched.
 *
 * Only case-marking particles are in the sets, and only where the check cannot fire on a normal
 * inflection. `で` and `ね` are excluded because `です` (headword `だ`) and `ねばった` (headword `粘る`)
 * would match the leading-particle shape; `に` is excluded because its hits are mostly `ように`, which
 * reads better as one word than as `よう` + `に`.
 */
@Component
class GluedParticleSplitter(
    private val jishoService: JishoService,
) {
    private val logger = LoggerFactory.getLogger(GluedParticleSplitter::class.java)

    suspend fun split(tokensByIndex: Map<Int, List<PipelineToken>>): Map<Int, List<PipelineToken>> {
        val candidates = tokensByIndex.values.flatten().mapNotNull { token ->
            gluedParticle(token)?.let { token to it }
        }
        if (candidates.isEmpty()) return tokensByIndex

        // The gate: is the glued form itself a dictionary word? いつも, ように and 何を are, and splitting
        // them would break a real entry into two grammar fragments.
        val lookups = jishoService.lookupAll(candidates.map { it.first.surface }.distinct())
        val splitByKey = mutableMapOf<PipelineTokenKey, List<PipelineToken>>()
        for ((token, glued) in candidates) {
            if (!isMissingFromDictionary(lookups[token.surface])) continue
            val split = splitToken(token, glued) ?: continue
            splitByKey[token.key] = split
            logger.info(
                "Split glued particle '{}' out of surface '{}' [{}] (headword '{}')",
                glued.particle,
                token.surface,
                token.usedReading,
                token.headword,
            )
        }
        if (splitByKey.isEmpty()) return tokensByIndex

        return tokensByIndex.mapValues { (_, tokens) ->
            tokens.flatMap { token -> splitByKey[token.key] ?: listOf(token) }
        }
    }

    /**
     * Which particle the model glued on, or null when the surface and headword do not contradict
     * each other. The trailing shape demands exact equality — `surface` minus its last character *is*
     * the headword — so an inflected form whose headword differs by more than that particle cannot
     * match. The leading shape has no such anchor (`がいなきゃ`'s headword is `いる`, not `いなきゃ`), so it
     * rests on the headword not starting with the particle at all.
     */
    private fun gluedParticle(token: PipelineToken): GluedParticle? {
        val surface = token.surface
        val headword = token.headword
        if (surface.length < 2 || headword.isEmpty()) return null
        if (surface.last() in TRAILING_PARTICLES && surface.dropLast(1) == headword) {
            return GluedParticle(surface.last(), trailing = true)
        }
        if (surface.first() in LEADING_PARTICLES && headword.first() != surface.first()) {
            return GluedParticle(surface.first(), trailing = false)
        }
        return null
    }

    /**
     * True only when jisho answered and had no entry for this exact form. A fetch error is not an
     * answer — treating it as "not a word" would let a network blip split real words — and
     * [JishoLookupProvenance.REJECTED_FALLBACK] means jisho returned neighbours but nothing spelled or
     * read like the query, which is the same as having no entry.
     */
    private fun isMissingFromDictionary(lookup: JishoEntryDto?): Boolean =
        lookup != null &&
            (
                lookup.provenance == JishoLookupProvenance.NOT_FOUND ||
                    lookup.provenance == JishoLookupProvenance.REJECTED_FALLBACK
                )

    /** The two tokens, in position order, or null when the reading cannot be divided without guessing. */
    private fun splitToken(token: PipelineToken, glued: GluedParticle): List<PipelineToken>? {
        val particle = glued.particle.toString()
        val particleReading = JapaneseText.toKatakana(particle)
        val wordSurface = if (glued.trailing) token.surface.dropLast(1) else token.surface.drop(1)
        if (!JapaneseText.containsJapanese(wordSurface)) return null
        val wordReading = wordReading(token, glued) ?: return null

        val word = PipelineToken(
            lineIndex = token.lineIndex,
            surface = wordSurface,
            headword = token.headword,
            charStart = if (glued.trailing) token.charStart else token.charStart + 1,
            charEnd = if (glued.trailing) token.charEnd - 1 else token.charEnd,
            usedReading = wordReading,
            // The headword did not change, so its reading did not either.
            baseFormReading = token.baseFormReading.ifBlank { wordReading },
            contextGloss = token.contextGloss,
        )
        val particleToken = PipelineToken(
            lineIndex = token.lineIndex,
            surface = particle,
            headword = particle,
            charStart = if (glued.trailing) token.charEnd - 1 else token.charStart,
            charEnd = if (glued.trailing) token.charEnd else token.charStart + 1,
            usedReading = particleReading,
            baseFormReading = particleReading,
            contextGloss = PARTICLE_GLOSS,
        )
        return if (glued.trailing) listOf(word, particleToken) else listOf(particleToken, word)
    }

    /**
     * The word's own reading once the particle's is taken off, or null when it cannot be told.
     *
     * The model writes the glued reading two ways and both are safe to divide: it either includes the
     * particle (`がある` → `ガアル`, so drop the particle's kana) or leaves it out and gives only the
     * word's reading (`までは` → `マデ`, so there is nothing to drop).
     *
     * In the trailing shape the word half is not inflected — its surface *is* the headword — so
     * `baseFormReading` says outright which of the two shapes this is, and that beats inspecting the
     * last character: `母は` with reading `ハハ` is 母 read ハハ, not 母 read ハ plus a particle, and only
     * the headword's reading can tell those apart.
     *
     * The leading shape has no such anchor (`がいなきゃ` is `いる` inflected), so it falls back to
     * [spokenReadings] — which also covers a particle *sung* differently from how it is spelled: 僕は
     * reads ボクワ, and leaving `ワ` on 僕 would hand the app a word pronounced wrong.
     *
     * Null is returned when nothing would be left for the word, because inventing a reading is
     * precisely what this class must not do.
     */
    private fun wordReading(token: PipelineToken, glued: GluedParticle): String? {
        val reading = token.usedReading
        if (reading.isBlank()) return null
        val headwordReading = token.baseFormReading
        if (glued.trailing && headwordReading.isNotBlank()) {
            if (reading == headwordReading) return reading
            if (reading.length == headwordReading.length + 1 && reading.startsWith(headwordReading)) {
                return headwordReading
            }
        }
        val glue = if (glued.trailing) reading.last() else reading.first()
        if (glue !in spokenReadings(glued.particle)) return reading
        if (reading.length < 2) return null
        return if (glued.trailing) reading.dropLast(1) else reading.drop(1)
    }

    /** Every katakana the particle can be sung as: `は` is spelled ハ but sung ワ, `を` ヲ but sung オ. */
    private fun spokenReadings(particle: Char): Set<Char> = when (particle) {
        'は' -> setOf('ハ', 'ワ')
        'を' -> setOf('ヲ', 'オ')
        'へ' -> setOf('ヘ', 'エ')
        else -> setOf(JapaneseText.toKatakana(particle.toString()).first())
    }

    private data class GluedParticle(val particle: Char, val trailing: Boolean)

    private companion object {
        /**
         * Particles that can be glued to the end of the word before them. Every one of these is in
         * [RuleMeaningProvider]'s particle table, so the token split off here gets its meaning from
         * the rule table and never reaches jisho or sense-select.
         */
        val TRAILING_PARTICLES = setOf('は', 'を', 'が', 'も')

        /** Particles that can be glued to the front. Same table requirement as [TRAILING_PARTICLES]. */
        val LEADING_PARTICLES = setOf('が', 'を', 'の', 'も')

        const val PARTICLE_GLOSS = "grammatical particle"
    }
}
