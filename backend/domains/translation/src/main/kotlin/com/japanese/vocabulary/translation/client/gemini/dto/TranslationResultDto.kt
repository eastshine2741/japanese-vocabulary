package com.japanese.vocabulary.translation.client.gemini.dto

/**
 * One translated lyric line. Pronunciation is deliberately absent: the line's reading is assembled in
 * [com.japanese.vocabulary.translation.service.pipeline.stage.AssembleAnalyzedLinesStage] from the
 * segmentation stage's per-token katakana readings, and the Korean transcription is derived on the
 * client from that katakana. Asking this model for it doubled the response length for a string the
 * pipeline can build deterministically.
 */
data class TranslationResultDto(
    val index: Int,
    val koreanLyrics: String,
)
