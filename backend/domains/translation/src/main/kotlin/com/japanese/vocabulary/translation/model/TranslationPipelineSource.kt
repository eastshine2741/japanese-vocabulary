package com.japanese.vocabulary.translation.model

import com.japanese.vocabulary.song.model.LyricLineData

data class TranslationPipelineSource(
    val lyricLines: List<LyricLineData>,
    val lineInput: List<Map<String, Any?>>,
    val rawByIndex: Map<Int, String>,
) {
    companion object {
        fun from(lyricLines: List<LyricLineData>) = TranslationPipelineSource(
            lyricLines = lyricLines,
            lineInput = lyricLines.map { mapOf("index" to it.index, "text" to it.text) },
            rawByIndex = lyricLines.associate { it.index to it.text },
        )
    }
}
