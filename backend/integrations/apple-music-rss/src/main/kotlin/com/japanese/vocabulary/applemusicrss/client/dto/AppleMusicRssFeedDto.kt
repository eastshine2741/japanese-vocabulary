package com.japanese.vocabulary.applemusicrss.client.dto

data class AppleMusicRssFeedDto(
    val title: String? = null,
    val id: String? = null,
    val country: String? = null,
    val updated: String? = null,
    val results: List<AppleMusicRssSongDto> = emptyList(),
)
