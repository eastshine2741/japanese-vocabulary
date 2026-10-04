package com.japanese.vocabulary.lyricsearch

interface LyricProvider {
    val providerName: String

    /**
     * null means the provider answered and has no lyrics for this song. A provider that could not
     * answer — a dropped connection, a 5xx, a 429 — throws instead, so the caller can retry it and
     * tell an outage apart from a miss.
     */
    fun search(query: NormalizedSongQuery): LyricsResult?
}
