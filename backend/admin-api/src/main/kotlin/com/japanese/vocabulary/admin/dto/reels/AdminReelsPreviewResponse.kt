package com.japanese.vocabulary.admin.dto.reels

import com.japanese.vocabulary.admin.reels.model.AdminReelsPromoData

data class AdminReelsPreviewResponse(
    /** Remotion `PromoReel` 컴포지션 props. `song.mvAsset` 은 비어 있고 [mvPath] 를 넣어 쓴다. */
    val data: AdminReelsPromoData,
    /** admin API base 기준 상대 경로. 미디어 토큰이 query 에 들어 있다. */
    val mvPath: String,
)
