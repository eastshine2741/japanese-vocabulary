package com.japanese.vocabulary.admin.reels.model

data class AdminReelsRenderSource(
    val youtubeUrl: String,
    /** 미리보기 캐시에 이미 받아 둔 source mp4. 있으면 렌더 스크립트가 다시 받지 않는다. */
    val localPath: String? = null,
)
