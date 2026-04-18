package com.japanese.vocabulary.song.client

interface LyricProvider {
    val providerName: String
    fun search(query: NormalizedSongQuery): LyricsResult?
}
