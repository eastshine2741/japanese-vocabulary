package com.japanese.vocabulary.translation.client.dictionary.dto

/**
 * How confidently a dictionary lookup was narrowed to one dictionary entry.
 *
 * The first three are usable; the last three yield no sense candidates at all.
 */
enum class DictionaryLookupProvenance {
    /** Headword and reading matched exactly one entry. */
    EXACT,

    /** Reading missed but exactly one entry carries the headword; absorbs a wrong `baseFormReading` from the segmentation LLM. */
    APPROVED_FALLBACK,

    /**
     * Several entries remain: the reading missed and more than one carries the headword, or a kana
     * headword (かける) matched several (掛ける / 賭ける / 欠ける). All candidates' senses are offered,
     * each labelled with its own headword/reading.
     */
    AMBIGUOUS_HEADWORD,

    /** No entry carried the headword. The bundled dictionary never produces it; stored stage payloads may still hold it. */
    REJECTED_FALLBACK,

    NOT_FOUND,
    FETCH_ERROR,
}
