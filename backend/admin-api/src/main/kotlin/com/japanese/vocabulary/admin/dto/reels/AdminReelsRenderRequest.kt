package com.japanese.vocabulary.admin.dto.reels

data class AdminReelsRenderRequest(
    val songId: Long,
    val lineIndexes: List<Int>,
    val acknowledgeSourceRightsAndPlatformRisk: Boolean,
)
