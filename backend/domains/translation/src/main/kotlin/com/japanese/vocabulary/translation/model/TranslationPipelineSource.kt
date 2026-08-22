package com.japanese.vocabulary.translation.model

import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.translation.client.gemini.GeminiCallContext

data class TranslationPipelineSource(
    val lyricLines: List<LyricLineData>,
    val lineInput: List<Map<String, Any?>>,
    val rawByIndex: Map<Int, String>,
    val callContext: GeminiCallContext,
) {
    companion object {
        fun from(lyricLines: List<LyricLineData>, callContext: GeminiCallContext) = TranslationPipelineSource(
            lyricLines = lyricLines,
            lineInput = lyricLines.map { mapOf("index" to it.index, "text" to it.text) },
            rawByIndex = lyricLines.associate { it.index to it.text },
            callContext = callContext,
        )
    }
}
