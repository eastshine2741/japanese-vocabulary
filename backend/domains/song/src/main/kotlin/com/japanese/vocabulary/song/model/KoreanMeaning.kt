package com.japanese.vocabulary.song.model

/**
 * A token's [Token.koreanText] holds exactly one meaning. The word save path splits on commas and merges
 * the same sense across songs, so "A, B" from one song and "A" from another pile up as "A, B, A".
 *
 * Shared by the analysis pipeline and the backfill that rewrites already-analyzed lyrics.
 */
object KoreanMeaning {

    /** The first comma-separated meaning. Commas inside brackets qualify one meaning: "(사람, 물건이) 있다". */
    fun first(koreanText: String): String {
        var depth = 0
        var start = 0
        for ((i, ch) in koreanText.withIndex()) {
            when (ch) {
                '(', '（', '[', '［' -> depth++
                ')', '）', ']', '］' -> if (depth > 0) depth--
                ',', '，', '、' -> if (depth == 0) {
                    val part = koreanText.substring(start, i).trim()
                    if (part.isNotEmpty()) return part
                    start = i + 1
                }
            }
        }
        return koreanText.substring(start).trim()
    }
}
