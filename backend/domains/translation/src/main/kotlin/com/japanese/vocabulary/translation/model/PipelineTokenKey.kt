package com.japanese.vocabulary.translation.model

data class PipelineTokenKey(
    val lineIndex: Int,
    val charStart: Int,
    val charEnd: Int,
    val surface: String,
) {
    val tokenId: String
        get() = "$lineIndex:$charStart:$charEnd:$surface"
}
