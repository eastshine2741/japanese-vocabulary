package com.japanese.vocabulary.common.text

/** Splits an artist credit (`椎名もた feat.鏡音リン`, `niki & リリィ`) into the names it lists. */
object ArtistCredit {
    // Word-bounded so `Kis-My-Ft2` stays whole; no space is required after the dot (`feat.鏡音リン`).
    private val FEATURING = Regex("""\s*\b(?:featuring|feat|ft)\b\.?\s*""", RegexOption.IGNORE_CASE)
    private val SEPARATORS = Regex("""\s*(?:\b(?:featuring|feat|ft)\b\.?|&|＆|×|,|、)\s*""", RegexOption.IGNORE_CASE)

    /** A `feat.` guest is not the artist: a virtual singer would otherwise pass as every producer. */
    fun withoutFeaturing(artist: String): String =
        artist.split(FEATURING, limit = 2).first().trim().ifBlank { artist.trim() }

    /** Every credited name, guests included, in credit order. The first is the main artist. */
    fun names(artist: String): List<String> =
        artist.split(SEPARATORS).map { it.trim() }.filter { it.isNotEmpty() }
}
