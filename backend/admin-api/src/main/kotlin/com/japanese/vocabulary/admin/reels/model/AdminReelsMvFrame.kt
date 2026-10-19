package com.japanese.vocabulary.admin.reels.model

/**
 * MV 배치(1080×1920 캔버스 기준). scale 은 (잘라낸) MV 폭 ÷ 릴스 폭, x/y 는 가운데에서 옮기는 px.
 * 빈 곳은 검게 남는다. `reels/src/types.ts` 의 `MvFrame` 과 같다.
 */
data class AdminReelsMvFrame(
    val scale: Double,
    val x: Double,
    val y: Double,
    /** MV 원본에서 각 변을 잘라낼 비율(0..1). 없으면 자르지 않는다. */
    val crop: AdminReelsMvCrop? = null,
)

data class AdminReelsMvCrop(
    val top: Double,
    val right: Double,
    val bottom: Double,
    val left: Double,
)

/** 이 프레임(릴스 기준)부터 [mvFrame] 배치로 바꾼다. null 이면 꽉 채움(cover). `reels/src/types.ts` 의 `MvKeyframe` 과 같다. */
data class AdminReelsMvKeyframe(
    val startFrame: Int,
    val mvFrame: AdminReelsMvFrame? = null,
)
