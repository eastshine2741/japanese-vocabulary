package com.japanese.vocabulary.karaoke.service

import com.japanese.vocabulary.common.text.ArtistCredit
import com.japanese.vocabulary.common.text.ArtistNameNormalizer

/**
 * 노래방 표기를 곡 이름으로 다듬는다. 노래방은 타이업·피처링을 괄호로 붙이고(`風のゆくえ(映画 'ONE PIECE FILM RED' OST)`),
 * 금영은 긴 표기를 ".." 로 자른다.
 */
object KaraokeTitleCleaner {
    private val PAREN_GROUP = Regex("""[(（][^()（）]*[)）]""")
    private val UNCLOSED_PAREN = Regex("""\s*[(（].*$""")
    private val LATIN_SUBTITLE = Regex("""\s+-\s+[\p{ASCII}]+$""")
    private val SPACES = Regex("""\s+""")
    private const val TRUNCATION = ".."
    private val VOCALLESS = Regex("""instrumental|\binst\b|off[\s-]?vocal|karaoke|オフボーカル|カラオケ|インスト""", RegexOption.IGNORE_CASE)

    fun isTruncated(raw: String): Boolean = raw.trimEnd().endsWith(TRUNCATION)

    fun cleanTitle(raw: String): String {
        var title = stripParens(raw.trim().removeSuffix(TRUNCATION))
        if (title.any { it.code > 0x7F }) title = title.replace(LATIN_SUBTITLE, "")
        return title.collapse().ifEmpty { raw.trim() }
    }

    fun cleanArtist(raw: String): String =
        ArtistCredit.withoutFeaturing(stripParens(raw.trim().removeSuffix(TRUNCATION))).collapse().ifEmpty { raw.trim() }

    /** 응답에서 같은 곡을 한 줄로 합칠 때 쓰는 키. */
    fun mergeKey(title: String, artist: String): String =
        ArtistNameNormalizer.normalize(title) + "\u0000" + ArtistNameNormalizer.normalize(artist)

    /**
     * 노래방 원문과 Apple Music 결과가 같은 곡인지. 가수는 메인 가수만 본다: 금영 `椎名もた feat.鏡音リン` 과
     * Apple Music `椎名もた & 鏡音リン` 처럼 함께 적는 방식이 서로 다르다. 잘린 표기는 앞부분만 맞으면 된다.
     * 반주 버전은 괄호를 지우면 원곡과 같아지지만 가사가 없어 분석이 실패하므로 다른 곡으로 본다.
     */
    fun sameSong(rawTitle: String, rawArtist: String, candidateTitle: String, candidateArtist: String): Boolean =
        (!VOCALLESS.containsMatchIn(candidateTitle) || VOCALLESS.containsMatchIn(rawTitle)) &&
            matches(rawTitle, candidateTitle, ::cleanTitle) && matches(rawArtist, candidateArtist, ::mainArtist)

    private fun mainArtist(raw: String): String = cleanArtist(raw).let { ArtistCredit.names(it).firstOrNull() ?: it }

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
