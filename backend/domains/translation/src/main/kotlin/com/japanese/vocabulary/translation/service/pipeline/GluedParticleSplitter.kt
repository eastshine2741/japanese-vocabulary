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
 * `幸せがある` can come back as `幸せ` + `がある` (headword `ある`, surface carrying the particle).
 *
 * A split only fires when surface and headword contradict each other: the surface is the headword
 * plus one particle character (`何を` / `何`), or opens with a particle the headword does not
 * (`がある` / `ある`).
 *
 * Wrongly splitting destroys a real dictionary entry, while leaving a glued token only mis-renders
 * it, so the token passes through untouched when the dictionary knows the glued form, the reading
 * does not line up, or jisho could not be reached.
 *
 * Only case-marking particles are in the sets. `で` and `ね` are excluded because `です` (headword
 * `だ`) and `ねばった` (`粘る`) would match the leading shape; `に` because its hits are mostly `ように`.
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

        // If the glued form itself is a dictionary word (いつも, ように), splitting would break a real entry.
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
     * Which particle the model glued on, or null when surface and headword do not contradict. The
     * trailing shape needs `surface` minus its last character to equal the headword; the leading
     * shape has no such anchor (`がいなきゃ` → `いる`), so it rests on the headword not starting with
     * the particle.
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
     * answer (a network blip must not split real words); [JishoLookupProvenance.REJECTED_FALLBACK]
     * counts as no entry.
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
     * The model's glued reading either includes the particle (`がある` → `ガアル`, drop its kana) or
     * omits it (`までは` → `マデ`, nothing to drop).
     *
     * In the trailing shape the word half is not inflected, so `baseFormReading` says which shape it
     * is (`母は` / `ハハ` is 母 read ハハ, not ハ plus a particle).
     *
     * The leading shape has no such anchor (`がいなきゃ` is `いる` inflected), so it falls back to
     * [spokenReadings], which also covers a particle sung differently from its spelling (僕は → ボクワ).
     *
     * Null when nothing would be left for the word; a reading is never invented.
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

    /**
     * Every katakana the particle can appear as, spelled or sung, because the model writes either.
     * Which one is stored is [JapaneseText.particleReading]'s call.
     */
    private fun spokenReadings(particle: Char): Set<Char> =
        setOfNotNull(
            JapaneseText.toKatakana(particle.toString()).first(),
            JapaneseText.sungParticleKana(particle),
        )

    private data class GluedParticle(val particle: Char, val trailing: Boolean)

    private companion object {
        /**
         * Particles that can be glued to the end of the word before them. Each must be in
         * [RuleMeaningProvider]'s particle table so the split-off token never reaches jisho.
         */
        val TRAILING_PARTICLES = setOf('は', 'を', 'が', 'も')

        /** Particles that can be glued to the front. Same table requirement as [TRAILING_PARTICLES]. */
        val LEADING_PARTICLES = setOf('が', 'を', 'の', 'も')

        const val PARTICLE_GLOSS = "grammatical particle"
    }
}
