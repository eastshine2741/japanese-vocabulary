package com.japanese.vocabulary.admin.reels.model

data class AdminReelsRenderSource(
    /** 어드민이 올려 둔 source mp4. 렌더 스크립트는 이 파일만 쓴다. */
    val localPath: String,
)
