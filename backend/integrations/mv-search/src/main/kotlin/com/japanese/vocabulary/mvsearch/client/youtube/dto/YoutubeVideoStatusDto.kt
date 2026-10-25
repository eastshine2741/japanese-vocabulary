package com.japanese.vocabulary.mvsearch.client.youtube.dto

data class YoutubeVideoStatusDto(
    /** public, unlisted, private */
    val privacyStatus: String? = null,
    val embeddable: Boolean? = null,
)
