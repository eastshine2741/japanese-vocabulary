package com.japanese.vocabulary.lyricsearch

object JapaneseLyricValidator {

    private const val MIN_JAPANESE_LINE_RATIO = 0.5
    private const val MAX_TRANSLATED_LINE_RATIO = 0.5
    private const val MIN_TRANSLATION_LETTERS = 3
    private val KANA_REGEX = Regex("[぀-ゟ゠-ヿｦ-ﾟ]")
    private val JAPANESE_REGEX = Regex("[぀-ゟ゠-ヿｦ-ﾟ一-鿿々]")
    private val LATIN_REGEX = Regex("[A-Za-z]")
    private val TRANSLATION_SEPARATOR = Regex("""\^|\s/\s|\|""")

    fun isJapaneseLyrics(lyrics: String): Boolean {
        val nonEmptyLines = lyrics.lines().filter { it.isNotBlank() }
        if (nonEmptyLines.isEmpty()) return false

        val kanaLineCount = nonEmptyLines.count { KANA_REGEX.containsMatchIn(it) }
        if (kanaLineCount.toDouble() / nonEmptyLines.size < MIN_JAPANESE_LINE_RATIO) return false

        // 「相槌が上手くなったんだ^You've gotten better…」처럼 줄마다 번역을 붙인 업로드는 가나가 있어 위를 통과한다.
        // 글자 비율로는 영어 후렴이 많은 K-pop 일본어판과 구분되지 않아 이 형태를 직접 본다.
        val translatedLineCount = nonEmptyLines.count(::isTranslatedLine)
        return translatedLineCount.toDouble() / nonEmptyLines.size <= MAX_TRANSLATED_LINE_RATIO
    }

    private fun isTranslatedLine(line: String): Boolean {
        val parts = line.split(TRANSLATION_SEPARATOR, limit = 2)
        if (parts.size < 2) return false
        val (original, translation) = parts
        return KANA_REGEX.containsMatchIn(original) &&
            LATIN_REGEX.findAll(translation).count() >= MIN_TRANSLATION_LETTERS &&
            !JAPANESE_REGEX.containsMatchIn(translation)
    }
}
