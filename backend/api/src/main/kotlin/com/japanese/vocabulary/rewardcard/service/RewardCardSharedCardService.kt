package com.japanese.vocabulary.rewardcard.service

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.rewardcard.config.ShareProperties
import com.japanese.vocabulary.rewardcard.dto.SharedCardOwnerResponse
import com.japanese.vocabulary.rewardcard.dto.SharedRewardCardResponse
import com.japanese.vocabulary.rewardcard.model.RewardCardKind
import com.japanese.vocabulary.user.service.ProfileImageService
import com.japanese.vocabulary.user.service.UserProfileService
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/** 토큰이 가리키는 카드의 지금 모습과 주인. 주인은 이름·프로필 사진만 내보낸다. */
@Service
class RewardCardSharedCardService(
    private val shareTokens: RewardCardShareTokens,
    private val rewardCardShareService: RewardCardShareService,
    private val rewardCardQueryService: RewardCardQueryService,
    private val userProfileService: UserProfileService,
    private val profileImageService: ProfileImageService,
    private val shareProperties: ShareProperties,
) {
    /** 서명이 틀렸거나, 카드가 사라졌거나, 주인이 탈퇴했으면 null. */
    @Transactional(readOnly = true)
    fun find(token: String): SharedRewardCardResponse? {
        val claims = shareTokens.parse(token) ?: return null
        val ref = rewardCardShareService.findIssuedCard(claims.kind, claims.cardId) ?: return null
        val owner = try {
            userProfileService.getProfile(ref.userId)
        } catch (e: BusinessException) {
            return null
        }
        val songCard = if (ref.kind == RewardCardKind.SONG) rewardCardQueryService.songCard(ref.userId, ref.targetId) ?: return null else null
        val artistCard = if (ref.kind == RewardCardKind.ARTIST) rewardCardQueryService.artistCard(ref.userId, ref.targetId) ?: return null else null
        return SharedRewardCardResponse(
            token = token,
            url = shareProperties.shareUrl(token),
            kind = ref.kind,
            songCard = songCard,
            artistCard = artistCard,
            owner = SharedCardOwnerResponse(name = owner.name, profileImageUrl = profileImageService.publicUrl(owner.profileImageKey)),
        )
    }
}
