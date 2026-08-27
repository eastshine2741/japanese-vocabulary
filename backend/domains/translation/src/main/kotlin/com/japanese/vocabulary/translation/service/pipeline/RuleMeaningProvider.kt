package com.japanese.vocabulary.translation.service.pipeline

import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.translation.model.PipelineToken
import com.japanese.vocabulary.translation.model.RuleResolvedToken
import org.springframework.stereotype.Component

@Component
class RuleMeaningProvider {

    fun rewrite(tokens: List<PipelineToken>): List<PipelineToken> {
        val rewritten = mutableListOf<PipelineToken>()
        var i = 0
        while (i < tokens.size) {
            val rule = rewriteRules.firstOrNull { it.matches(tokens, i) }
            if (rule == null) {
                val current = tokens[i]
                rewritten += current
                i += 1
            } else {
                rewritten += rule.apply(tokens, i)
                i += rule.surfaces.size
            }
        }
        return rewritten
    }

    fun resolve(token: PipelineToken): RuleResolvedToken? {
        val key = token.headword.ifBlank { token.surface }
        return fixedExpressions[token.surface]
            ?: fixedExpressions[key]
            ?: particles[token.surface]
            ?: particles[key]
            ?: auxiliaries[token.surface]
            ?: auxiliaries[key]
    }

    private companion object {
        // This table only handles deterministic grammar rewrites that Jisho/sense-select cannot
        // recover from once the LLM has segmented them too coarsely. Ambiguous lexical items stay
        // out of this table so context-aware sense selection can still choose the meaning.
        val rewriteRules = listOf(
            TokenRewriteRule(
                surfaces = listOf("どうも", "こうも"),
                replacements = listOf(
                    TokenReplacement(
                        "どう",
                        "どう",
                        sourceIndex = 0,
                        startOffset = 0,
                        endOffset = 2,
                        contextGloss = "how, in what way",
                    ),
                    TokenReplacement(
                        "も",
                        "も",
                        sourceIndex = 0,
                        startOffset = 2,
                        endOffset = 3,
                        contextGloss = "also, too",
                    ),
                    TokenReplacement(
                        "こう",
                        "こう",
                        sourceIndex = 1,
                        startOffset = 0,
                        endOffset = 2,
                        contextGloss = "this way, like this",
                    ),
                    TokenReplacement(
                        "も",
                        "も",
                        sourceIndex = 1,
                        startOffset = 2,
                        endOffset = 3,
                        contextGloss = "also, too",
                    ),
                ),
            ),
            TokenRewriteRule(
                surfaces = listOf("ここまで"),
                replacements = listOf(
                    TokenReplacement(
                        "ここ",
                        "ここ",
                        sourceIndex = 0,
                        startOffset = 0,
                        endOffset = 2,
                        contextGloss = "here, this place",
                    ),
                    TokenReplacement(
                        "まで",
                        "まで",
                        sourceIndex = 0,
                        startOffset = 2,
                        endOffset = 4,
                        contextGloss = "until, as far as",
                    ),
                ),
            ),
            TokenRewriteRule(
                surfaces = listOf("そこまで"),
                replacements = listOf(
                    TokenReplacement(
                        "そこ",
                        "そこ",
                        sourceIndex = 0,
                        startOffset = 0,
                        endOffset = 2,
                        contextGloss = "there, that place",
                    ),
                    TokenReplacement(
                        "まで",
                        "まで",
                        sourceIndex = 0,
                        startOffset = 2,
                        endOffset = 4,
                        contextGloss = "until, as far as",
                    ),
                ),
            ),
            TokenRewriteRule(
                surfaces = listOf("あそこまで"),
                replacements = listOf(
                    TokenReplacement(
                        "あそこ",
                        "あそこ",
                        sourceIndex = 0,
                        startOffset = 0,
                        endOffset = 3,
                        contextGloss = "over there",
                    ),
                    TokenReplacement(
                        "まで",
                        "まで",
                        sourceIndex = 0,
                        startOffset = 3,
                        endOffset = 5,
                        contextGloss = "until, as far as",
                    ),
                ),
            ),
            TokenRewriteRule(
                surfaces = listOf("どこまで"),
                replacements = listOf(
                    TokenReplacement(
                        "どこ",
                        "どこ",
                        sourceIndex = 0,
                        startOffset = 0,
                        endOffset = 2,
                        contextGloss = "where, what place",
                    ),
                    TokenReplacement(
                        "まで",
                        "まで",
                        sourceIndex = 0,
                        startOffset = 2,
                        endOffset = 4,
                        contextGloss = "until, as far as",
                    ),
                ),
            ),
        )

        // Surfaces stay as written; readings are katakana because that is the one script the whole
        // pipeline stores readings in — the app converts from katakana for display.
        val fixedExpressions = mapOf(
            "どうして" to RuleResolvedToken("どうして", "どうして", "ドウシテ", "ドウシテ", PartOfSpeech.ADVERB, "왜, 어째서"),
            "如何して" to RuleResolvedToken("如何して", "どうして", "ドウシテ", "ドウシテ", PartOfSpeech.ADVERB, "왜, 어째서"),
            "どう" to RuleResolvedToken("どう", "どう", "ドウ", "ドウ", PartOfSpeech.ADVERB, "어떻게"),
            "こう" to RuleResolvedToken("こう", "こう", "コウ", "コウ", PartOfSpeech.ADVERB, "이렇게"),
            "だってば" to RuleResolvedToken("だってば", "だってば", "ダッテバ", "ダッテバ", PartOfSpeech.EXPRESSION, "~라니까"),
        )

        val particles = mapOf(
            "は" to particle("は", "~은/는"),
            "が" to particle("が", "~이/가"),
            "を" to particle("を", "~을/를"),
            "の" to particle("の", "~의"),
            "に" to particle("に", "~에, ~에게"),
            "へ" to particle("へ", "~으로"),
            "と" to particle("と", "~와/과, ~라고"),
            "も" to particle("も", "~도"),
            "まで" to particle("まで", "~까지"),
            "で" to particle("で", "~에서, ~로"),
            "や" to particle("や", "~이나"),
            "か" to particle("か", "~인가"),
            "ね" to particle("ね", "~네"),
            "よ" to particle("よ", "~야"),
        )

        val auxiliaries = mapOf(
            "ている" to auxiliary("ている", "~하고 있다"),
            "てる" to auxiliary("てる", "~하고 있다"),
            "た" to auxiliary("た", "~했다"),
            "だ" to auxiliary("だ", "~이다"),
        )

        // Every surface in the particle/auxiliary tables is kana, so its reading is the surface —
        // transliterated to katakana, which is the script readings are stored in.
        fun particle(surface: String, koreanText: String) =
            RuleResolvedToken(
                surface,
                surface,
                JapaneseText.toKatakana(surface),
                JapaneseText.toKatakana(surface),
                PartOfSpeech.PARTICLE,
                koreanText,
            )

        fun auxiliary(surface: String, koreanText: String) =
            RuleResolvedToken(
                surface,
                surface,
                JapaneseText.toKatakana(surface),
                JapaneseText.toKatakana(surface),
                PartOfSpeech.AUXILIARY_VERB,
                koreanText,
            )

        data class TokenRewriteRule(
            val surfaces: List<String>,
            val replacements: List<TokenReplacement>,
        ) {
            fun matches(tokens: List<PipelineToken>, startIndex: Int): Boolean {
                if (startIndex + surfaces.size > tokens.size) return false
                return surfaces.indices.all { offset -> tokens[startIndex + offset].surface == surfaces[offset] }
            }

            fun apply(tokens: List<PipelineToken>, startIndex: Int): List<PipelineToken> =
                replacements.map { replacement ->
                    val source = tokens[startIndex + replacement.sourceIndex]
                    PipelineToken(
                        lineIndex = source.lineIndex,
                        surface = replacement.surface,
                        headword = replacement.headword,
                        charStart = source.charStart + replacement.startOffset,
                        charEnd = source.charStart + replacement.endOffset,
                        usedReading = JapaneseText.toKatakana(replacement.surface),
                        baseFormReading = JapaneseText.toKatakana(replacement.headword),
                        contextGloss = replacement.contextGloss,
                    )
                }
        }

        /**
         * A rewrite discards the LLM's segmentation for this span, readings included, so the
         * replacement has to supply its own. It does that by transliterating [surface] and [headword]
         * — which only works because **every replacement here is a kana surface whose reading is
         * itself** (どう, も, ここ, まで). A rule whose replacement contains kanji would produce a kanji
         * "reading"; such a rule must carry explicit readings instead of relying on this.
         */
        data class TokenReplacement(
            val surface: String,
            val headword: String,
            val sourceIndex: Int,
            val startOffset: Int,
            val endOffset: Int,
            /**
             * Replaces the gloss the segmentation model would have written for this span. Without it
             * the rewritten token reaches sense-select with an empty hint, which is worse than not
             * rewriting: `ここ` is a kana headword and jisho answers it with five homophones.
             */
            val contextGloss: String = "",
        )
    }
}
