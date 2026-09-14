package com.japanese.vocabulary.lyricsearch

import java.text.Normalizer

/** Folds width, case, spacing, and punctuation so `米津 玄師` and `米津玄師` compare equal. */
object ArtistNameNormalizer {
    private val NOISE = Regex("""[\s　・._\-_/()\[\]（）【】「」『』"'!?！？:：]+""")

    fun normalize(value: String): String =
        Normalizer.normalize(value, Normalizer.Form.NFKC)
            .lowercase()
            .replace(NOISE, "")
}
