package com.japanese.vocabulary.translation.client.jisho

import com.japanese.vocabulary.song.model.PartOfSpeech

/**
 * Maps jisho.org English part-of-speech labels onto the app's [PartOfSpeech] enum.
 *
 * Per the morphological-analysis decisions, reliable POS comes from jisho (dictionary grounding),
 * not from Kuromoji. jisho labels are free-form strings (e.g. "Godan verb with 'ku' ending",
 * "Na-adjective (keiyodoshi)"), and a sense carries an ordered list of them where the FIRST entry is
 * the primary reading of the word — so label order is preserved rather than re-ranked.
 *
 * Two things make naive substring matching wrong:
 *
 * 1. **Descriptive labels embed other POS names.** `"Noun which may take the genitive case particle
 *    'no'"` contains "particle" and `"Noun or verb acting prenominally"` contains "verb". Matching on
 *    bare substrings classified 当たり前 / 最低 / 最初 / 隣 as [PartOfSpeech.PARTICLE]. Each label is now
 *    classified by its leading token, so anything starting with "noun" is a noun.
 * 2. **Usage markers are not primary POS.** The same two labels (JMdict `adj-no` / `adj-f`) describe how
 *    a noun may be used, and jisho often lists them first — 当たり前 arrives as
 *    ["Noun which may take …", "Na-adjective (keiyodoshi)", "Noun"]. They are treated as weak: they only
 *    decide the POS when no other label in the sense classifies, so 当たり前 resolves to
 *    [PartOfSpeech.NA_ADJECTIVE] while a sense tagged only `adj-no` (日々) still resolves to
 *    [PartOfSpeech.NOUN].
 *
 * Unknown / empty input falls back to [PartOfSpeech.OTHER].
 */
object JishoPartOfSpeechMapper {

    fun map(jishoPos: List<String>): PartOfSpeech {
        var weak: PartOfSpeech? = null
        for (raw in jishoPos) {
            val s = raw.lowercase().trim()
            val pos = classify(s) ?: continue
            if (isUsageMarker(s)) {
                if (weak == null) weak = pos
                continue
            }
            return pos
        }
        return weak ?: PartOfSpeech.OTHER
    }

    /**
     * JMdict `adj-no` ("Noun which may take the genitive case particle 'no'") and `adj-f`
     * ("Noun or verb acting prenominally") describe an inflectional habit, not the word class.
     */
    private fun isUsageMarker(s: String): Boolean =
        s.startsWith("noun which may take") ||
            s.startsWith("nouns which may take") ||
            s.startsWith("noun or verb acting")

    private fun classify(s: String): PartOfSpeech? = when {
        // "Noun, used as a prefix/suffix" describes the actual usage, so it outranks the "noun" head.
        "used as a prefix" in s -> PartOfSpeech.PREFIX
        "used as a suffix" in s -> PartOfSpeech.SUFFIX

        s.startsWith("na-adjective") || s.startsWith("adjectival noun") || "keiyodoshi" in s ->
            PartOfSpeech.NA_ADJECTIVE
        s.startsWith("i-adjective") || "keiyoushi" in s -> PartOfSpeech.ADJECTIVE
        s.startsWith("auxiliary") -> PartOfSpeech.AUXILIARY_VERB
        s.startsWith("pre-noun adjectival") || "rentaishi" in s -> PartOfSpeech.ADNOMINAL
        s.startsWith("pronoun") -> PartOfSpeech.PRONOUN
        // BEFORE the generic "verb"/"particle" fallbacks: "noun which may take … particle 'no'",
        // "noun or verb acting prenominally".
        s.startsWith("noun") -> PartOfSpeech.NOUN
        // BEFORE verb: "adverb" contains the substring "verb", and "adverb taking the 'to' particle"
        // contains "particle".
        s.startsWith("adverb") || "fukushi" in s -> PartOfSpeech.ADVERB
        s.startsWith("conjunction") -> PartOfSpeech.CONJUNCTION
        s.startsWith("interjection") || "kandoushi" in s -> PartOfSpeech.INTERJECTION
        s == "particle" -> PartOfSpeech.PARTICLE
        s == "prefix" -> PartOfSpeech.PREFIX
        s == "suffix" || s == "counter" -> PartOfSpeech.SUFFIX
        s.startsWith("expression") || "phrase" in s || "clause" in s -> PartOfSpeech.EXPRESSION
        "verb" in s -> PartOfSpeech.VERB
        "adjective" in s -> PartOfSpeech.ADJECTIVE
        "noun" in s -> PartOfSpeech.NOUN
        else -> null
    }
}
