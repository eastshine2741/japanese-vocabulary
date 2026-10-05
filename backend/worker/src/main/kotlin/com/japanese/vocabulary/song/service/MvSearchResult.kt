package com.japanese.vocabulary.song.service

import com.fasterxml.jackson.annotation.JsonInclude

/** The picked MV, or null, with every candidate the search looked at. */
data class MvSearchResult(
    val url: String?,
    val candidates: List<MvSearchCandidate>,
)

/**
 * One video the search considered. [rejection] is set when a filter dropped it before ranking;
 * a null rejection means it reached ranking and lost on [score], [artistVerified] or [officialSource].
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class MvSearchCandidate(
    /** `uploads` (cached artist channel), `search`, or `search:viewCount`. */
    val source: String,
    val videoId: String,
    val title: String,
    val channelTitle: String,
    val durationSeconds: Long? = null,
    val rejection: String? = null,
    val score: Int? = null,
    val artistVerified: Boolean? = null,
    val officialSource: Boolean? = null,
    val live: Boolean? = null,
) {
    companion object {
        fun rejected(source: String, videoId: String, title: String, channelTitle: String, rejection: String) =
            MvSearchCandidate(source, videoId, title, channelTitle, rejection = rejection)
    }
}
