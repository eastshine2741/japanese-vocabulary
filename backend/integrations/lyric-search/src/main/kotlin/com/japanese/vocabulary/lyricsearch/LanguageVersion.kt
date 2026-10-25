package com.japanese.vocabulary.lyricsearch

import java.text.Normalizer

/** Language-version markers in a title ("UNDEAD (English Version)", "LOVE DIVE (Japanese ver.)"). */
object LanguageVersion {

    private val MARKER_RE = Regex(
        """(english|korean|japanese|chinese|thai|英語|韓国語|日本語|中国語)\s*(?:ver\.?|version|バージョン)""",
        RegexOption.IGNORE_CASE,
    )
    private val NAMES = mapOf("英語" to "english", "韓国語" to "korean", "日本語" to "japanese", "中国語" to "chinese")

    fun of(title: String): Set<String> =
        MARKER_RE.findAll(Normalizer.normalize(title, Normalizer.Form.NFKC))
            .map { it.groupValues[1].lowercase().let { name -> NAMES[name] ?: name } }
            .toSet()

    /** A version sung in another language has no Japanese lyrics, so any Japanese text found for it is the original's. */
    fun isNonJapanese(title: String): Boolean = of(title).let { it.isNotEmpty() && "japanese" !in it }
}
