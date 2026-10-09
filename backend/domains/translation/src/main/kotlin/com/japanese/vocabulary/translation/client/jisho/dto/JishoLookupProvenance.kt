package com.japanese.vocabulary.translation.client.jisho.dto

/**
 * How confidently a jisho lookup was narrowed to one dictionary entry.
 *
 * The first three are usable; the last three yield no sense candidates at all.
 */
enum class JishoLookupProvenance {
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

    /** No entry carried the headword. jisho's top hit is retained as evidence but never used. */
    REJECTED_FALLBACK,

    NOT_FOUND,
    FETCH_ERROR,
}
