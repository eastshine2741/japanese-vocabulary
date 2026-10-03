package com.japanese.vocabulary.translation.service.pipeline

import com.japanese.vocabulary.translation.model.PipelineSenseOption

/**
 * Drops sense candidates that cannot be the answer before sense-select sees them. It never picks a
 * meaning; it only removes options no line could mean.
 */
object SenseCandidateNarrowing {

    /**
     * The contextGloss wording the segment stage uses for a function word, and the jisho POS families
     * that can match it. First match wins, so the more specific wording comes first.
     */
    private val functionWordHints = listOf(
        Regex("particle|connective|sentence[- ]ending|quotative") to listOf("particle", "conjunction"),
        Regex("conjunction") to listOf("conjunction", "particle"),
        Regex("auxiliary|polite suffix|progressive|politeness") to listOf("auxiliary"),
        Regex("prefix") to listOf("prefix"),
        Regex("suffix") to listOf("suffix", "auxiliary", "counter"),
    )

    fun narrow(contextGloss: String, options: List<PipelineSenseOption>): List<PipelineSenseOption> =
        keepFunctionWordSenses(contextGloss, dropRepeatedGlosses(options))

    /**
     * Variant spellings of one word (此れ/是/之/維/惟 for これ) come back from jisho as separate
     * entries repeating the same glosses; one copy is kept.
     */
    private fun dropRepeatedGlosses(options: List<PipelineSenseOption>): List<PipelineSenseOption> =
        options.distinctBy { it.english to it.rawPos }

    /**
     * The segment stage already said this token is a function word, so a content-word homophone
     * cannot be it: 手 is not て, 升 is not ます, 輪 is not わ. Skipped when no candidate has the POS
     * the hint names — a hint that matches nothing is not evidence that everything is wrong.
     */
    private fun keepFunctionWordSenses(
        contextGloss: String,
        options: List<PipelineSenseOption>,
    ): List<PipelineSenseOption> {
        val gloss = contextGloss.lowercase()
        val families = functionWordHints.firstOrNull { (hint, _) -> hint.containsMatchIn(gloss) }?.second
            ?: return options
        val kept = options.filter { option ->
            val pos = option.rawPos.joinToString(" / ").lowercase()
            families.any { it in pos }
        }
        return kept.ifEmpty { options }
    }
}
