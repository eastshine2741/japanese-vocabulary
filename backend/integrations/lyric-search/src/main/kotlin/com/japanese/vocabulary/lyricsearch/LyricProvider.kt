package com.japanese.vocabulary.lyricsearch

interface LyricProvider {
    val providerName: String
    fun search(query: NormalizedSongQuery): LyricsResult?
}
