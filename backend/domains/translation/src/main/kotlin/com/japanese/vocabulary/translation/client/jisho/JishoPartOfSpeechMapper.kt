package com.japanese.vocabulary.translation.client.jisho

import com.japanese.vocabulary.song.model.PartOfSpeech

/**
 * Maps jisho.org English part-of-speech labels onto the app's [PartOfSpeech] enum.
 *
 * Per the morphological-analysis decisions, reliable POS comes from jisho (dictionary grounding),
 * not from Kuromoji. jisho labels are free-form strings (e.g. "Godan verb with 'ku' ending",
 * "Na-adjective (keiyodoshi)"), so matching is substring-based with a deliberate priority order:
 * more specific labels (na-adjective, i-adjective, auxiliary verb) are tested before broader ones
 * (noun, verb). Unknown / empty input falls back to [PartOfSpeech.OTHER].
 */
object JishoPartOfSpeechMapper {

    fun map(jishoPos: List<String>): PartOfSpeech {
        for (raw in jishoPos) {
            val s = raw.lowercase()
            val pos = when {
                "na-adjective" in s || "adjectival noun" in s || "keiyodoshi" in s -> PartOfSpeech.NA_ADJECTIVE
                "i-adjective" in s || "keiyoushi" in s -> PartOfSpeech.ADJECTIVE
                "auxiliary verb" in s || s == "auxiliary" -> PartOfSpeech.AUXILIARY_VERB
                "adverb" in s -> PartOfSpeech.ADVERB // BEFORE verb: "adverb" contains the substring "verb"
                "verb" in s -> PartOfSpeech.VERB
                "particle" in s -> PartOfSpeech.PARTICLE
                "conjunction" in s -> PartOfSpeech.CONJUNCTION
                "pronoun" in s -> PartOfSpeech.PRONOUN
                "interjection" in s || "kandoushi" in s -> PartOfSpeech.INTERJECTION
                "pre-noun adjectival" in s || "rentaishi" in s -> PartOfSpeech.ADNOMINAL
                "prefix" in s -> PartOfSpeech.PREFIX
                "suffix" in s || "counter" in s -> PartOfSpeech.SUFFIX
                "noun" in s -> PartOfSpeech.NOUN
                else -> null
            }
            if (pos != null) return pos
        }
        return PartOfSpeech.OTHER
    }
}
