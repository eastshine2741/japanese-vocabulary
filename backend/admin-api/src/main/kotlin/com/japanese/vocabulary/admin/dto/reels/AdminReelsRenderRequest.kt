package com.japanese.vocabulary.admin.dto.reels

import com.japanese.vocabulary.admin.reels.model.AdminReelsPromoData

data class AdminReelsRenderRequest(
    val songId: Long,
    /**
     * 어드민 에디터가 만든 Remotion `PromoReel` props. 클립 시작·끝, 줄별 시작 프레임, 줄별 단어를
     * 어드민이 직접 정하므로 서버는 DB 타임스탬프를 보지 않고 이 값을 검증만 해서 렌더한다.
     */
    val data: AdminReelsPromoData,
    val acknowledgeSourceRightsAndPlatformRisk: Boolean,
)
