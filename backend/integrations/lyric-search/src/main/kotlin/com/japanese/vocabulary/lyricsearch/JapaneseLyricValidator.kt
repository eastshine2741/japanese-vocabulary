package com.japanese.vocabulary.lyricsearch

object JapaneseLyricValidator {

    private const val MIN_JAPANESE_LINE_RATIO = 0.5
    private val KANA_REGEX = Regex("[぀-ゟ゠-ヿｦ-ﾟ]")

    fun isJapaneseLyrics(lyrics: String): Boolean {
        val nonEmptyLines = lyrics.lines().filter { it.isNotBlank() }
        if (nonEmptyLines.isEmpty()) return false

        val kanaLineCount = nonEmptyLines.count { KANA_REGEX.containsMatchIn(it) }
        return kanaLineCount.toDouble() / nonEmptyLines.size >= MIN_JAPANESE_LINE_RATIO
    }
}
