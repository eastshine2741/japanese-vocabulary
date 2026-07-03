package com.japanese.vocabulary.lyricsearch.vocadb

import com.japanese.vocabulary.lyricsearch.NormalizedSongQuery
import com.japanese.vocabulary.lyricsearch.vocadb.dto.VocadbSongDto
import java.text.Normalizer

object VocadbSongMatcher {
    private const val DURATION_TOLERANCE_SECONDS = 8

    fun matches(query: NormalizedSongQuery, song: VocadbSongDto): Boolean {
        val directArtistTokens = query.artistParts.map { normalizeText(it) }
        if (directArtistTokens.isEmpty()) return false

        val artistText = normalizeText(song.artistString)
        if (directArtistTokens.any { artistText.contains(it) }) return true

        if (!hasExactTitleMatch(query, song)) return false
        if (!hasCloseDuration(query, song)) return false

        val metadataText = metadataText(song)
        return directArtistTokens.any { metadataText.contains(it) }
    }

    private fun hasExactTitleMatch(query: NormalizedSongQuery, song: VocadbSongDto): Boolean {
        val expected = normalizeText(query.normalizedTitle)
        if (normalizeText(song.name) == expected) return true
        return song.names.orEmpty().any { normalizeText(it.value) == expected }
    }

    private fun hasCloseDuration(query: NormalizedSongQuery, song: VocadbSongDto): Boolean {
        val expected = query.durationSeconds ?: return true
        val actual = song.lengthSeconds ?: return true
        return kotlin.math.abs(expected - actual) <= DURATION_TOLERANCE_SECONDS
    }

    private fun metadataText(song: VocadbSongDto): String {
        val values = buildList {
            song.artists.orEmpty().forEach { artist ->
                add(artist.name)
                add(artist.artist?.name)
                add(artist.artist?.additionalNames)
            }
            song.pvs.orEmpty().forEach { pv ->
                add(pv.name)
                add(pv.author)
                add(pv.description)
                add(pv.url)
            }
            song.webLinks.orEmpty().forEach { webLink ->
                add(webLink.description)
                add(webLink.url)
            }
        }
        return normalizeText(values.filterNotNull().joinToString(" "))
    }

    private fun normalizeText(value: String): String =
        Normalizer.normalize(value, Normalizer.Form.NFKC)
            .lowercase()
            .replace(Regex("""[\s　・._\-_/()\[\]（）【】「」『』"'!?！？:：]+"""), "")
}
