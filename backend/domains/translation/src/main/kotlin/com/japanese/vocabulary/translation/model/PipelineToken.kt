package com.japanese.vocabulary.translation.model

data class PipelineToken(
    val lineIndex: Int,
    val surface: String,
    val headword: String,
    val charStart: Int,
    val charEnd: Int,
    /** Reading as sung on this line, katakana. Empty only for tokens rules rewrote before normalization. */
    val usedReading: String = "",
    /** Reading of [headword], katakana. Half of the `(headword, reading)` jisho entry key. */
    val baseFormReading: String = "",
    /** Short English hint at the meaning this line uses; sense-select matches it against jisho glosses. */
    val contextGloss: String = "",
) {
    val key: PipelineTokenKey = PipelineTokenKey(lineIndex, charStart, charEnd, surface)
}
