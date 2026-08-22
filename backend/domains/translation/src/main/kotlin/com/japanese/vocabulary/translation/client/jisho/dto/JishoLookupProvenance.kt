package com.japanese.vocabulary.translation.client.jisho.dto

/**
 * How confidently a jisho lookup was narrowed to one dictionary entry.
 *
 * The first three are usable; the last three yield no sense candidates at all.
 */
enum class JishoLookupProvenance {
    /** Headword and reading matched exactly one entry. The senses are that word's, and only that word's. */
    EXACT,

    /**
     * Reading did not match, but exactly one entry carries the headword — so there is nothing to
     * confuse it with. Absorbs a wrong `baseFormReading` from the segmentation LLM instead of dropping
     * the word's meaning entirely.
     */
    APPROVED_FALLBACK,

    /**
     * Several entries remain in play, so the word stays genuinely ambiguous. Either the reading missed
     * and more than one entry carries the headword, or the reading matched more than one entry — a
     * kana headword does the latter, since lyrics write かける in kana and 掛ける / 賭ける / 欠ける all
     * read カケル.
     *
     * Every candidate entry's senses are offered, each labelled with its own headword/reading so
     * sense-select can tell them apart — the one case where the flat list of the old design is still
     * the right shape, now with the boundary made visible.
     */
    AMBIGUOUS_HEADWORD,

    /** No entry carried the headword. jisho's top hit is retained as evidence but never used. */
    REJECTED_FALLBACK,

    NOT_FOUND,
    FETCH_ERROR,
}
