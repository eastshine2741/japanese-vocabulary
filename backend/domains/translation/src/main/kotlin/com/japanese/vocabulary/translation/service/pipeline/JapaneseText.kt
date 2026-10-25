package com.japanese.vocabulary.translation.service.pipeline

/**
 * The single kana-normalization entry point for the pipeline. Readings arrive in mixed scripts (LLM,
 * dictionary, [RuleMeaningProvider]) but the app's `readingConverter.convertReading` assumes **katakana**;
 * a hiragana reading silently breaks its display modes. Every reading normalizes through [toKatakana].
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
     * `・` (U+30FB), `゠` (U+30A0), `ヿ` (U+30FF) and the combining dakuten sit inside the katakana
     * block but are punctuation; counting them would deadlock segmentation retries on a line like
     * `ロックン・ロール`. Conversely `々` is outside every kana/kanji block yet read aloud.
     */
    fun containsJapanese(text: String): Boolean = text.any { it.hasReading() }

    /** Hiragana → katakana. Every other character (katakana, kanji, latin, symbols) passes through. */
    fun toKatakana(text: String): String = text.map { ch ->
        if (ch in HIRAGANA_START..HIRAGANA_END) ch + KATAKANA_OFFSET else ch
    }.joinToString("")

    /**
     * Katakana → hiragana, for a **dictionary lookup key** only, never a reading.
     */
    fun toHiragana(text: String): String = text.map { ch ->
        if (ch in KATAKANA_START..KATAKANA_END) ch - KATAKANA_OFFSET else ch
    }.joinToString("")

    /** Small vowel kana and the full-size kana they are the same sound as. */
    private val SMALL_VOWEL_KANA = mapOf('ァ' to 'ア', 'ィ' to 'イ', 'ゥ' to 'ウ', 'ェ' to 'エ', 'ォ' to 'オ')

    /** The hiragana counterpart of [SMALL_VOWEL_KANA]. */
    private val SMALL_VOWEL_HIRAGANA = mapOf('ぁ' to 'あ', 'ぃ' to 'い', 'ぅ' to 'う', 'ぇ' to 'え', 'ぉ' to 'お')

    /**
     * True when two readings differ only in whether a vowel is written small: `ハァ` and `ハア` are the
     * same reading, so neither is a correction of the other.
     */
    fun readingsAgree(a: String, b: String): Boolean = fullSizeVowels(a) == fullSizeVowels(b)

    private fun fullSizeVowels(text: String): String =
        text.map { ch -> SMALL_VOWEL_KANA[ch] ?: ch }.joinToString("")

    /**
     * [text] with a trailing small vowel kana written full size — `さぁ` → `さあ`, `ハァ` → `ハア` — or
     * null when it does not end in one. Lyrics stretch a word with a small vowel; the dictionary
     * indexes only the full-size spelling.
     */
    fun fullSizeTrailingVowel(text: String): String? {
        val last = text.lastOrNull() ?: return null
        val full = SMALL_VOWEL_HIRAGANA[last] ?: SMALL_VOWEL_KANA[last] ?: return null
        return text.dropLast(1) + full
    }

    /**
     * True when [text] is non-empty and made only of kana (either script) plus the prolonged sound
     * mark. Keeps an unnormalized surface from being stored as a reading.
     */
    fun isKanaOnly(text: String): Boolean =
        text.isNotEmpty() && text.all { ch ->
            ch in HIRAGANA_START..HIRAGANA_END ||
                ch in KATAKANA_START..KATAKANA_END ||
                ch == PROLONGED_SOUND_MARK
        }

    /** Kana sung differently from how they are spelled. */
    private val SUNG_KANA = mapOf('は' to 'ワ', 'へ' to 'エ', 'を' to 'オ')

    /** The katakana a kana particle is *sung* as when that differs from its spelling; null otherwise. */
    fun sungParticleKana(particle: Char): Char? = SUNG_KANA[particle]

    /**
     * True when [text] is non-empty and written only in katakana (plus the prolonged sound mark).
     *
     * Marks words a dictionary is not expected to know (coined loanwords, onomatopoeia, names); they
     * are exempt from the headword check instead of burning segmentation retries.
     */
    fun isKatakanaOnly(text: String): Boolean =
        text.isNotEmpty() && text.all { ch -> ch in KATAKANA_START..KATAKANA_END || ch == PROLONGED_SOUND_MARK }

    /**
     * [text] without the ASCII or full-width digits at either end. `80億` is a number and a counter;
     * only the counter is a word, and the dictionary has no entry for the pair.
     */
    fun trimDigits(text: String): String = text.trim { it.isAsciiOrFullWidthDigit() }

    private fun Char.isAsciiOrFullWidthDigit(): Boolean = this in '0'..'9' || this in '０'..'９'

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
