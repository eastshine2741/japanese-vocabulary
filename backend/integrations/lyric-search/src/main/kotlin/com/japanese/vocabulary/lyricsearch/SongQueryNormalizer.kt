package com.japanese.vocabulary.lyricsearch

import com.japanese.vocabulary.common.text.ArtistCredit

object SongQueryNormalizer {

    private val FEAT_PATTERN = Regex(
        """\s*[(\[（](?:feat\.?|ft\.?|featuring)\s+[^)\]）]+[)\]）]""",
        RegexOption.IGNORE_CASE
    )

    fun normalize(title: String, artist: String, durationSeconds: Int?): NormalizedSongQuery {
        return NormalizedSongQuery(
            originalTitle = title,
            originalArtist = artist,
            normalizedTitle = stripFeatFromTitle(title),
            artistParts = ArtistCredit.names(artist),
            durationSeconds = durationSeconds
        )
    }

    private fun stripFeatFromTitle(title: String): String {
        return FEAT_PATTERN.replace(title, "").trim()
    }
}
