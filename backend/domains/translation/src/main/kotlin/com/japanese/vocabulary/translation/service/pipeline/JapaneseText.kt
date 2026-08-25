package com.japanese.vocabulary.translation.service.pipeline

/**
 * The single kana-normalization entry point for the pipeline.
 *
 * Readings enter the pipeline from three sources that disagree on script: the segmentation LLM
 * (asked for katakana, sometimes answers in hiragana), jisho (always hiragana), and
 * [RuleMeaningProvider]'s hand-written table (hiragana surfaces). The app's
 * `readingConverter.convertReading` assumes **katakana** input — its `KANA_MAP` keys are katakana, so
 * a hiragana reading silently breaks both the katakana and the Korean display modes. Everything that
 * produces a reading therefore normalizes through [toKatakana] here, and nowhere else.
 */
object JapaneseText {

    private const val HIRAGANA_START = 'ぁ' // U+3041
    private const val HIRAGANA_END = 'ゖ' // U+3096
    private const val KATAKANA_OFFSET = 0x60

    private const val KATAKANA_START = 'ァ' // U+30A1
    private const val KATAKANA_END = 'ヺ' // U+30FA
    private const val PROLONGED_SOUND_MARK = 'ー' // U+30FC
    private const val KANJI_ITERATION_MARK = '々' // U+3005

    /**
     * True when [text] contains a character that is *pronounced* — kana, kanji, or the marks that
     * stand in for one (`々`, `ー`, the kana iteration marks).
     *
     * The exclusions matter as much as the inclusions. `・` (U+30FB), `゠` (U+30A0), `ヿ` (U+30FF) and
     * the combining dakuten all sit inside the katakana Unicode block but are punctuation: they have
     * no reading. Counting them as Japanese would demand a reading no model can supply and no
     * [isKanaOnly] check can accept, deadlocking segmentation retries for a line like `ロックン・ロール`.
     * Conversely `々` sits outside every kana and kanji block yet is read aloud, so leaving it out let
     * `人々` pass segmentation with `々` uncovered and leak a raw glyph into the assembled reading.
     */
    fun containsJapanese(text: String): Boolean = text.any { it.hasReading() }

    /** Hiragana → katakana. Every other character (katakana, kanji, latin, symbols) passes through. */
    fun toKatakana(text: String): String = text.map { ch ->
        if (ch in HIRAGANA_START..HIRAGANA_END) ch + KATAKANA_OFFSET else ch
    }.joinToString("")

    /**
     * True when [text] is non-empty and made only of kana (either script) plus the prolonged sound
     * mark. Kanji, latin, digits, and punctuation all make it false — this is the check that keeps an
     * unnormalized surface from being stored as if it were a reading.
     */
    fun isKanaOnly(text: String): Boolean =
        text.isNotEmpty() && text.all { ch ->
            ch in HIRAGANA_START..HIRAGANA_END ||
                ch in KATAKANA_START..KATAKANA_END ||
                ch == PROLONGED_SOUND_MARK
        }

    /**
     * True when [text] is non-empty and written only in katakana (plus the prolonged sound mark).
     *
     * Marks the words a Japanese dictionary is not expected to answer: loanwords the lyric coined
     * (`ステンバイミー`), onomatopoeia (`チリン`, `ダラッ`), and names. A missing dictionary entry is
     * evidence of bad segmentation for everything else, but for these it is simply the truth, so they
     * are exempt from the headword check instead of burning segmentation retries.
     */
    fun isKatakanaOnly(text: String): Boolean =
        text.isNotEmpty() && text.all { ch -> ch in KATAKANA_START..KATAKANA_END || ch == PROLONGED_SOUND_MARK }

    private fun Char.hasReading(): Boolean =
        this in HIRAGANA_START..HIRAGANA_END ||
            this in KATAKANA_START..KATAKANA_END ||
            this == PROLONGED_SOUND_MARK ||
            this == KANJI_ITERATION_MARK ||
            this in 'ゝ'..'ゞ' || // U+309D-309E hiragana iteration marks
            this in 'ヽ'..'ヾ' || // U+30FD-30FE katakana iteration marks
            this in '一'..'鿿' || // CJK unified ideographs
            this in '㐀'..'䶿' || // CJK extension A
            this in 'ｦ'..'ﾝ' // half-width katakana, stopping before the dakuten marks ﾞﾟ
}
