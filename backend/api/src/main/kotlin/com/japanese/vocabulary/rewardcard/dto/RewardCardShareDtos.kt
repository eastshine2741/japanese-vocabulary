package com.japanese.vocabulary.rewardcard.dto

import com.japanese.vocabulary.rewardcard.model.RewardCardKind
import java.time.Instant

data class ShareRewardCardRequest(
    /** 미리보기를 막 올렸으면 true. 올라간 객체를 확인한다. */
    val imageUploaded: Boolean = false,
)

data class RewardCardShareResponse(
    val token: String,
    val url: String,
)

data class ShareImageUploadUrlResponse(
    val uploadUrl: String,
    /** PUT 에 그대로 실어야 한다. 서명에 들어간 헤더다. */
    val headers: Map<String, String>,
    val expiresAt: Instant,
)

/** 공유 링크로 보는 남의 카드. 카드 모양은 내 카드 목록과 같고 kind 에 맞는 쪽만 채운다. */
data class SharedRewardCardResponse(
    val token: String,
    val url: String,
    val kind: RewardCardKind,
    val songCard: SongCardResponse?,
    val artistCard: ArtistCardResponse?,
    val owner: SharedCardOwnerResponse,
    /** 받는 사람은 카드 목록을 받지 않아 등급 조건을 여기 싣는다. */
    val songGradeRule: SongGradeRuleResponse,
)

data class SharedCardOwnerResponse(
    val name: String,
    val profileImageUrl: String?,
)
