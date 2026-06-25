package com.japanese.vocabulary.lyricsearch

data class LyricsResult(
    val lrclibId: Long? = null,
    val vocadbId: Long? = null,
    val lyrics: String,
    val isSynced: Boolean
)
