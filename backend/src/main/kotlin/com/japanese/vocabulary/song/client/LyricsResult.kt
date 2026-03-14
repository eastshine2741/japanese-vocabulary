package com.japanese.vocabulary.song.client

data class LyricsResult(
    val lrclibId: Long? = null,
    val vocadbId: Long? = null,
    val lyrics: String,
    val isSynced: Boolean
)
