package com.japanese.vocabulary.translation.model

data class PipelineToken(
    val lineIndex: Int,
    val surface: String,
    val dictionaryForm: String,
    val charStart: Int,
    val charEnd: Int,
) {
    val key: PipelineTokenKey = PipelineTokenKey(lineIndex, charStart, charEnd, surface)
}
