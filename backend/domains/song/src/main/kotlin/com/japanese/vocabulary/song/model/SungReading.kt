package com.japanese.vocabulary.song.model

/**
 * A token's reading as it is *sung*. The app derives the Korean pronunciation from [Token.reading]
 * alone, so a spelling-faithful reading (には → ニハ) shows the wrong Hangul.
 *
 * Shared by the analysis pipeline and the backfill that rewrites already-analyzed lyrics, so the
 * two cannot drift apart.
 */
object SungReading {

    private const val HIRAGANA_START = 'ぁ'
    private const val HIRAGANA_END = 'ゖ'
    private const val KATAKANA_START = 'ァ'
    private const val KATAKANA_END = 'ヺ'
    private const val KATAKANA_OFFSET = 0x60
    private const val PROLONGED_SOUND_MARK = 'ー'

    /** Kana a particle is sung differently from its spelling. を is sung オ but stays ヲ: both read 오. */
    private val PARTICLE_KANA = mapOf('は' to 'ワ', 'へ' to 'エ')

    /** The app has no Hangul for these, so a surface spelled with them keeps the model's reading. */
    private const val ARCHAIC_KANA = "ゎゐゑゕゖヮヰヱヵヶヷヸヹヺ"

    /** Kana words that really end in は. */
    private val WORDS_ENDING_IN_HA = setOf("いろは", "このは", "ことのは", "あげは")

    /**
     * [reading] corrected to what is sung, or [reading] itself when it already is. [previousChar] is
     * the line character right before the token.
     */
    fun of(surface: String, partOfSpeech: PartOfSpeech, reading: String?, previousChar: Char?): String? {
        if (reading.isNullOrBlank()) return reading
        val katakana = toKatakana(reading)
        // A reading of another length spilled into the next token (の read ノガ) or lost a mora
        // (まったく read マッタクト). One of the same length is kept: デワナイ, ハア, ユウ are sung so.
        val spelled = if (isModernKana(surface) && katakana.length != surface.length) toKatakana(surface) else katakana
        return when {
            partOfSpeech == PartOfSpeech.PARTICLE && isModernKana(surface) ->
                surface.map { ch -> PARTICLE_KANA[ch] ?: toKatakana(ch.toString()).first() }.joinToString("")
            endsInTopicParticle(surface, partOfSpeech) && spelled.endsWith('ハ') -> spelled.dropLast(1) + 'ワ'
            surface == "時" && spelled == "トキ" && previousChar?.isDigitAnyWidth() == true -> "ジ"
            else -> spelled
        }
    }

    /** A final hiragana は is the topic particle (見たのは, 実は, こんにちは), bar laughter (あっはっは). */
    private fun endsInTopicParticle(surface: String, partOfSpeech: PartOfSpeech): Boolean {
        if (surface.length < 2 || !surface.endsWith('は') || surface in WORDS_ENDING_IN_HA) return false
        if (partOfSpeech == PartOfSpeech.INTERJECTION) return false
        return surface[surface.length - 2] !in "っはー"
    }

    private fun isModernKana(text: String): Boolean =
        text.isNotEmpty() && text.all { ch ->
            (ch in HIRAGANA_START..HIRAGANA_END || ch in KATAKANA_START..KATAKANA_END || ch == PROLONGED_SOUND_MARK) &&
                ch !in ARCHAIC_KANA
        }

    private fun toKatakana(text: String): String = text.map { ch ->
        if (ch in HIRAGANA_START..HIRAGANA_END) ch + KATAKANA_OFFSET else ch
    }.joinToString("")

    private fun Char.isDigitAnyWidth(): Boolean = this in '0'..'9' || this in '０'..'９'
}
