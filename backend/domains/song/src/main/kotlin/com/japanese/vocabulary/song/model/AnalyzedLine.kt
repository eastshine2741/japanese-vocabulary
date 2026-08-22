package com.japanese.vocabulary.song.model

data class AnalyzedLine(
    val index: Int,
    val koreanLyrics: String?,
    /**
     * Hangul transcription produced by the old translation prompt. Read-only legacy: analysis has
     * stopped filling it and always writes null. It stays on the model so `analyzed_content` rows
     * written before [pronounciation] existed still deserialize. Delete once every song has been
     * re-analyzed.
     */
    @Deprecated("Legacy data only. New analysis writes null; clients read pronounciation.")
    val koreanPronounciation: String? = null,
    /**
     * The line's reading in katakana, assembled from the segmentation stage's per-token readings with
     * the original spacing and punctuation kept between them. Clients convert it for display —
     * katakana, hiragana, or Hangul — so the transcription no longer costs an LLM call.
     */
    val pronounciation: String? = null,
    val tokens: List<Token>
)
