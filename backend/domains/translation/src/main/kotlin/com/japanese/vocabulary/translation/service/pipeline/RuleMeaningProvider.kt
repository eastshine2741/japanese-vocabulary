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

    /**
     * [previous] is the token before this one on the line. Particles with several functions (で, と, の) take
     * their meaning from it and from the segment stage's contextGloss; without it they get the commonest one.
     */
    fun resolve(token: PipelineToken, previous: PipelineToken? = null): RuleResolvedToken? {
        val key = token.headword.ifBlank { token.surface }
        // Before the headword lookups: ん under headword の would otherwise come back as the possessive の.
        val resolved = fixedExpressions[token.surface]
            ?: particles[token.surface]
            ?: auxiliaries[token.surface]
            ?: contextualParticles[token.surface]?.takeIf { key in it.headwords }?.resolved
            ?: fixedExpressions[key]
            ?: particles[key]
            ?: auxiliaries[key]
            ?: return null
        val koreanText = contextualMeaning(token, previous) ?: return resolved
        return resolved.copy(koreanText = koreanText)
    }

    private fun contextualMeaning(token: PipelineToken, previous: PipelineToken?): String? {
        val gloss = token.contextGloss.lowercase()
        val after = previous?.takeIf { it.charEnd == token.charStart }
        return when (token.surface) {
            "で" -> when {
                // ないで is "without doing / don't", never the location particle.
                after != null && after.surface.endsWith("ない") -> "~하지 말고"
                after != null && isVoicedTeStem(after) -> "~하고"
                gloss.contains("without") || gloss.contains("negative") -> "~하지 말고"
                gloss.contains("copula") -> "~이고"
                // "at, in, with" is still a place.
                DE_LOCATION.containsMatchIn(gloss) -> null
                DE_MEANS.containsMatchIn(gloss) -> "~로"
                DE_CONNECTIVE.containsMatchIn(gloss) -> "~하고"
                else -> null
            }
            "と" -> when {
                gloss.contains("quot") -> "~라고"
                gloss.contains("even if") -> "~해도"
                TO_CONDITIONAL.containsMatchIn(gloss) -> "~하면"
                else -> null
            }
            "の" -> when {
                gloss.contains("nominal") -> "~것"
                gloss.contains("explanat") -> "~거야"
                gloss.contains("question") -> "~니"
                else -> null
            }
            // 僕ん家: ん standing for the possessive の.
            "ん" -> if (gloss.contains("possess")) "~의" else null
            "って" -> when {
                gloss.contains("topic") || gloss.contains("as for") -> "~은/는"
                gloss.contains("even if") -> "~해도"
                else -> null
            }
            "じゃ" -> if (JA_CONJUNCTION.containsMatchIn(gloss)) "그럼" else null
            else -> null
        }
    }

    /** 読ん(で), 泳い(で): godan te-forms voice て to で, so this で is the connective, not a particle. */
    private fun isVoicedTeStem(token: PipelineToken): Boolean =
        token.surface != token.headword &&
            (token.surface.endsWith("ん") || token.surface.endsWith("い")) &&
            token.headword.lastOrNull() in VOICED_TE_DICTIONARY_ENDINGS

    /**
     * One-character particles [resolve] settles without the dictionary. [SegmentAnchoringValidator]
     * fills these in itself when segmentation leaves one out, so a retry is not spent on them.
     */
    object KnownParticles {
        val singleCharacter: Set<String> = particles.keys.filter { it.length == 1 }.toSet()
    }

    private companion object {
        // Only deterministic grammar rewrites that the dictionary/sense-select cannot recover from; ambiguous
        // lexical items stay out so sense selection can choose.
        val rewriteRules = listOf(
            // どうにもこうにも: こうにも arrives as one surface and headword, like こんなにも below.
            TokenRewriteRule(
                surfaces = listOf("こうにも"),
                replacements = listOf(
                    TokenReplacement("こう", "こう", sourceIndex = 0, startOffset = 0, endOffset = 2, contextGloss = "this way, like this"),
                    TokenReplacement("に", "に", sourceIndex = 0, startOffset = 2, endOffset = 3, contextGloss = "in, to"),
                    TokenReplacement("も", "も", sourceIndex = 0, startOffset = 3, endOffset = 4, contextGloss = "also, too"),
                ),
            ),
            // やな (いやな) + もの: segmentation glues them into the headword 嫌な物, which the dictionary lacks.
            TokenRewriteRule(
                surfaces = listOf("やなもの"),
                replacements = listOf(
                    TokenReplacement("やな", "やな", sourceIndex = 0, startOffset = 0, endOffset = 2, contextGloss = "unpleasant"),
                    TokenReplacement("もの", "もの", sourceIndex = 0, startOffset = 2, endOffset = 4, contextGloss = "thing"),
                ),
            ),
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
            // GluedParticleSplitter only splits a glued particle off when the surface and the
            // headword disagree; when the model writes こんなにも as both, it has nothing to catch.
            TokenRewriteRule(
                surfaces = listOf("こんなにも"),
                replacements = listOf(
                    TokenReplacement(
                        "こんなに",
                        "こんなに",
                        sourceIndex = 0,
                        startOffset = 0,
                        endOffset = 4,
                        contextGloss = "to this extent, so much",
                    ),
                    TokenReplacement(
                        "も",
                        "も",
                        sourceIndex = 0,
                        startOffset = 4,
                        endOffset = 5,
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

        // Surfaces stay as written; readings are katakana, the pipeline's storage script.
        val fixedExpressions = mapOf(
            "どうして" to RuleResolvedToken("どうして", "どうして", "ドウシテ", "ドウシテ", PartOfSpeech.ADVERB, "왜"),
            "如何して" to RuleResolvedToken("如何して", "どうして", "ドウシテ", "ドウシテ", PartOfSpeech.ADVERB, "왜"),
            "どう" to RuleResolvedToken("どう", "どう", "ドウ", "ドウ", PartOfSpeech.ADVERB, "어떻게"),
            "こう" to RuleResolvedToken("こう", "こう", "コウ", "コウ", PartOfSpeech.ADVERB, "이렇게"),
            // Archaic 〜の随(まにま)に: segmentation splits off に, so the token reads マニマ, not マニマニ.
            "随" to RuleResolvedToken("随", "随", "マニマ", "マニマ", PartOfSpeech.NOUN, "~대로"),
            // Second half of やたらめったら, a colloquial stretch of 滅多. The dictionary has no headword for it.
            "めったら" to RuleResolvedToken("めったら", "めったら", "メッタラ", "メッタラ", PartOfSpeech.ADVERB, "마구"),
            // Colloquial contraction of いやだ. Segmentation writes the headword as 嫌だ, which the dictionary
            // has no entry for. Keyed on the surface only: いやだ shares that headword but not the reading.
            "やだ" to RuleResolvedToken("やだ", "嫌だ", "ヤダ", "イヤダ", PartOfSpeech.NA_ADJECTIVE, "싫다"),
            // Attributive of the same contraction (やなもの), split off by the rewrite above.
            "やな" to RuleResolvedToken("やな", "嫌だ", "ヤナ", "イヤダ", PartOfSpeech.NA_ADJECTIVE, "싫은"),
            // Colloquial やんなる; segmentation writes the headword やになる, which the dictionary lacks.
            "やになる" to RuleResolvedToken("やになる", "嫌になる", "ヤニナル", "イヤニナル", PartOfSpeech.VERB, "싫어지다"),
            // ゝ repeats the kana before it; the dictionary has only ああ.
            "あゝ" to RuleResolvedToken("あゝ", "ああ", "アア", "アア", PartOfSpeech.INTERJECTION, "아아"),
            // Slang stretch of きしょい; the dictionary has no っ form.
            "きっしょい" to RuleResolvedToken("きっしょい", "きっしょい", "キッショイ", "キッショイ", PartOfSpeech.ADJECTIVE, "징그럽다"),
            // あーだこーだ comes back as two halves, neither of which the dictionary has.
            "あーだ" to RuleResolvedToken("あーだ", "あーだ", "アーダ", "アーダ", PartOfSpeech.ADVERB, "이러쿵"),
            "こーだ" to RuleResolvedToken("こーだ", "こーだ", "コーダ", "コーダ", PartOfSpeech.ADVERB, "저러쿵"),
            // Colloquial ものだ.
            "もんだ" to RuleResolvedToken("もんだ", "ものだ", "モンダ", "モノダ", PartOfSpeech.EXPRESSION, "~하는 법이다"),
            // Segmentation writes the headword as 何て言う, which the dictionary has no entry for.
            "なんていう" to RuleResolvedToken("なんていう", "何て言う", "ナンテイウ", "ナンテイウ", PartOfSpeech.EXPRESSION, "무슨"),
            "何て言う" to RuleResolvedToken("何て言う", "何て言う", "ナンテイウ", "ナンテイウ", PartOfSpeech.EXPRESSION, "무슨"),
        )

        val particles = mapOf(
            "は" to particle("は", "~은/는"),
            "が" to particle("が", "~이/가"),
            "を" to particle("を", "~을/를"),
            "の" to particle("の", "~의"),
            "に" to particle("に", "~에"),
            "へ" to particle("へ", "~으로"),
            "と" to particle("と", "~와/과"),
            "も" to particle("も", "~도"),
            "まで" to particle("まで", "~까지"),
            "で" to particle("で", "~에서"),
            "や" to particle("や", "~이나"),
            "か" to particle("か", "~인가"),
            "ね" to particle("ね", "~네"),
            "よ" to particle("よ", "~야"),
            // だけ + で. The model emits だけで as both surface and headword, so GluedParticleSplitter
            // sees no mismatch and the dictionary has no entry for the combined form.
            "だけで" to particle("だけで", "~만으로"),
            // Connective て; SegmentAnchoringValidator fills it in when the model leaves it off the verb.
            "て" to particle("て", "~하고"),
        )

        /**
         * Rule-resolved only under these headwords: the surface alone also spells other words — ん is the
         * negative ぬ (知らん), じゃ ends a contracted てしまう (死んじゃ).
         */
        val contextualParticles = mapOf(
            "ん" to ContextualParticle(setOf("ん", "の", "のだ", "んだ"), particle("ん", "~거야")),
            "って" to ContextualParticle(setOf("って", "と", "という", "とて"), particle("って", "~라고")),
            "じゃ" to ContextualParticle(setOf("じゃ", "では", "だ", "ではない"), particle("じゃ", "~이/가")),
        )

        val VOICED_TE_DICTIONARY_ENDINGS = setOf('ぐ', 'む', 'ぶ', 'ぬ')
        val DE_LOCATION = Regex("\\bat\\b|\\bin\\b|locat|place")
        val DE_MEANS = Regex("\\bby\\b|\\bwith\\b|means|instrument|using|manner|state|cause|because")
        val DE_CONNECTIVE = Regex("connective|\\band\\b|te-form")
        val TO_CONDITIONAL = Regex("\\bwhen\\b|\\bif\\b|condition")
        val JA_CONJUNCTION = Regex("then|if so|\\bwell\\b|\\bso\\b")

        data class ContextualParticle(val headwords: Set<String>, val resolved: RuleResolvedToken)

        val auxiliaries = mapOf(
            "ている" to auxiliary("ている", "~하고 있다"),
            "てる" to auxiliary("てる", "~하고 있다"),
            // Keyed on the headword: segmentation normalises っちゃった/じゃった/ちゃう to てしまう.
            "てしまう" to auxiliary("てしまう", "~해 버리다"),
            // Segmentation glues する onto ていく after a する-noun (回転していく) and emits していく as
            // the headword; the dictionary has no entry for either form.
            "ていく" to auxiliary("ていく", "~해 가다"),
            "していく" to auxiliary("していく", "~해 가다"),
            "している" to auxiliary("している", "~하고 있다"),
            // Same headword fallback: segmentation normalises といて/とく to ておく.
            "ておく" to auxiliary("ておく", "~해 두다"),
            "た" to auxiliary("た", "~했다"),
            "だ" to auxiliary("だ", "~이다"),
            // Conditional ending; segmentation also normalizes the colloquial りゃ to this headword.
            "れば" to auxiliary("れば", "~하면"),
            // た/だ + conditional ら. Segmentation splits 掴んだら into 掴ん + だら; the dictionary has no entry for
            // the suffix. だら is the voiced form after ん/ぶ/ぐ stems.
            "たら" to auxiliary("たら", "~하면"),
            "だら" to auxiliary("だら", "~하면"),
            // Colloquial concessive (even if). Segmentation splits 舞ったったって into 舞った + ったって and
            // guesses the headword といったって, which the dictionary lacks; resolve() tries the surface first.
            "たって" to auxiliary("たって", "~해도"),
            "ったって" to auxiliary("ったって", "~해도"),
        )

        // Every surface in the particle/auxiliary tables is kana, so its reading is the surface in katakana.
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
         * A rewrite discards the LLM's readings, so the replacement's are transliterated from [surface]
         * and [headword]. That only works while **every replacement is a kana surface whose reading is
         * itself** (どう, も, ここ); a kanji replacement must carry explicit readings.
         */
        data class TokenReplacement(
            val surface: String,
            val headword: String,
            val sourceIndex: Int,
            val startOffset: Int,
            val endOffset: Int,
            /**
             * Replaces the gloss the segmentation model would have written for this span; without it the
             * token reaches sense-select with an empty hint (`ここ` gets five homophones from the dictionary).
             */
            val contextGloss: String = "",
        )
    }
}
