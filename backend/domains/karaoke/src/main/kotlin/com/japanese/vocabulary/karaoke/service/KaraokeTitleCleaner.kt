package com.japanese.vocabulary.karaoke.service

import com.japanese.vocabulary.common.text.ArtistNameNormalizer

/**
 * 노래방 표기를 곡 이름으로 다듬는다. 노래방은 타이업·피처링을 괄호로 붙이고(`風のゆくえ(映画 'ONE PIECE FILM RED' OST)`),
 * 금영은 긴 표기를 ".." 로 자른다.
 */
object KaraokeTitleCleaner {
    private val PAREN_GROUP = Regex("""[(（][^()（）]*[)）]""")
    private val UNCLOSED_PAREN = Regex("""\s*[(（].*$""")
    private val LATIN_SUBTITLE = Regex("""\s+-\s+[\p{ASCII}]+$""")
    private val FEAT_SUFFIX = Regex("""\s+(feat|ft)\.?\s.*$""", RegexOption.IGNORE_CASE)
    private val SPACES = Regex("""\s+""")
    private const val TRUNCATION = ".."

    fun isTruncated(raw: String): Boolean = raw.trimEnd().endsWith(TRUNCATION)

    fun cleanTitle(raw: String): String {
        var title = stripParens(raw.trim().removeSuffix(TRUNCATION))
        if (title.any { it.code > 0x7F }) title = title.replace(LATIN_SUBTITLE, "")
        return title.collapse().ifEmpty { raw.trim() }
    }

    fun cleanArtist(raw: String): String =
        stripParens(raw.trim().removeSuffix(TRUNCATION)).replace(FEAT_SUFFIX, "").collapse().ifEmpty { raw.trim() }

    /** 응답에서 같은 곡을 한 줄로 합칠 때 쓰는 키. */
    fun mergeKey(title: String, artist: String): String =
        ArtistNameNormalizer.normalize(title) + "\u0000" + ArtistNameNormalizer.normalize(artist)

    /** 노래방 원문과 iTunes 결과가 같은 곡인지. 잘린 표기는 앞부분만 맞으면 된다. */
    fun sameSong(rawTitle: String, rawArtist: String, candidateTitle: String, candidateArtist: String): Boolean =
        matches(rawTitle, candidateTitle, ::cleanTitle) && matches(rawArtist, candidateArtist, ::cleanArtist)

    private fun matches(raw: String, candidate: String, clean: (String) -> String): Boolean {
        val wanted = ArtistNameNormalizer.normalize(clean(raw))
        val actual = ArtistNameNormalizer.normalize(clean(candidate))
        if (wanted.isEmpty()) return false
        return if (isTruncated(raw)) actual.startsWith(wanted) else actual == wanted
    }

    private fun stripParens(value: String): String {
        var current = value
        while (true) {
            val next = current.replace(PAREN_GROUP, "")
            if (next == current) break
            current = next
        }
        return current.replace(UNCLOSED_PAREN, "")
    }

    private fun String.collapse(): String = replace(SPACES, " ").trim()
}
