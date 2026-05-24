package com.japanese.vocabulary.song.client

object JapaneseLyricValidator {

    private val KANA_REGEX = Regex("[぀-ゟ゠-ヿｦ-ﾟ]")

    fun isJapaneseLyrics(lyrics: String): Boolean {
        val nonEmptyLines = lyrics.lines().filter { it.isNotBlank() }
        if (nonEmptyLines.isEmpty()) return false

        val kanaLineCount = nonEmptyLines.count { KANA_REGEX.containsMatchIn(it) }
        return kanaLineCount.toDouble() / nonEmptyLines.size >= 0.5
    }
}
