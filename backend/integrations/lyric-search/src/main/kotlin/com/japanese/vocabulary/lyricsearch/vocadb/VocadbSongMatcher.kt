package com.japanese.vocabulary.lyricsearch.vocadb

import com.japanese.vocabulary.lyricsearch.ArtistNameNormalizer
import com.japanese.vocabulary.lyricsearch.NormalizedSongQuery
import com.japanese.vocabulary.lyricsearch.vocadb.dto.VocadbArtistSearchItemDto
import com.japanese.vocabulary.lyricsearch.vocadb.dto.VocadbSongDto

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

    /**
     * For results VocaDB already filtered by artist id: the artist is settled, so only the song
     * identity is checked — an exact title, or a close duration when both sides know it.
     */
    fun matchesWithinArtist(query: NormalizedSongQuery, song: VocadbSongDto): Boolean {
        if (!hasCloseDuration(query, song)) return false
        if (hasExactTitleMatch(query, song)) return true
        return query.durationSeconds != null && song.lengthSeconds != null
    }

    /** Whether an artist search result is the artist itself, not a prefix or substring hit. */
    fun isSameArtist(artistPart: String, artist: VocadbArtistSearchItemDto): Boolean {
        val expected = normalizeText(artistPart)
        if (normalizeText(artist.name) == expected) return true
        if (artist.names.orEmpty().any { normalizeText(it.value) == expected }) return true
        return artist.additionalNames.orEmpty().split(',').any { normalizeText(it) == expected }
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

    private fun normalizeText(value: String): String = ArtistNameNormalizer.normalize(value)
}
