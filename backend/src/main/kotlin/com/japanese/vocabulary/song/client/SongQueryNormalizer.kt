package com.japanese.vocabulary.song.client

object SongQueryNormalizer {

    private val FEAT_PATTERN = Regex(
        """\s*[(\[（](?:feat\.?|ft\.?|featuring)\s+[^)\]）]+[)\]）]""",
        RegexOption.IGNORE_CASE
    )

    private val ARTIST_SEPARATORS = Regex(
        """\s*(?:&|＆|feat\.?|ft\.?|featuring|×|,|、)\s*""",
        RegexOption.IGNORE_CASE
    )

    fun normalize(title: String, artist: String, durationSeconds: Int?): NormalizedSongQuery {
        return NormalizedSongQuery(
            originalTitle = title,
            originalArtist = artist,
            normalizedTitle = stripFeatFromTitle(title),
            artistParts = splitArtist(artist),
            durationSeconds = durationSeconds
        )
    }

    private fun stripFeatFromTitle(title: String): String {
        return FEAT_PATTERN.replace(title, "").trim()
    }

    private fun splitArtist(artist: String): List<String> {
        return artist.split(ARTIST_SEPARATORS)
            .map { it.trim() }
            .filter { it.isNotBlank() }
    }
}
