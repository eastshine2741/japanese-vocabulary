package com.japanese.vocabulary.rewardcard.controller

import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.rewardcard.config.ShareProperties
import com.japanese.vocabulary.rewardcard.dto.RewardCardShareResponse
import com.japanese.vocabulary.rewardcard.dto.ShareImageUploadUrlResponse
import com.japanese.vocabulary.rewardcard.dto.ShareRewardCardRequest
import com.japanese.vocabulary.rewardcard.dto.SharedRewardCardResponse
import com.japanese.vocabulary.rewardcard.model.RewardCardKind
import com.japanese.vocabulary.rewardcard.service.RewardCardShareImageService
import com.japanese.vocabulary.rewardcard.service.RewardCardShareService
import com.japanese.vocabulary.rewardcard.service.RewardCardShareTokens
import com.japanese.vocabulary.rewardcard.service.RewardCardSharedCardService
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

@RestController
class RewardCardShareController(
    private val rewardCardShareService: RewardCardShareService,
    private val rewardCardShareImageService: RewardCardShareImageService,
    private val rewardCardSharedCardService: RewardCardSharedCardService,
    private val shareTokens: RewardCardShareTokens,
    private val shareProperties: ShareProperties,
) {
    /** 같은 카드는 늘 같은 링크다. */
    @PutMapping("/api/reward-cards/{kind:song-cards|artist-cards}/{id}/share")
    fun share(
        @PathVariable kind: String,
        @PathVariable id: Long,
        @RequestBody(required = false) request: ShareRewardCardRequest?,
    ): RewardCardShareResponse {
        val token = myCardToken(kind, id)
        if (request?.imageUploaded == true) rewardCardShareImageService.validateUploaded(token)
        return RewardCardShareResponse(token = token, url = shareProperties.shareUrl(token))
    }

    @PostMapping("/api/reward-cards/{kind:song-cards|artist-cards}/{id}/share/image-upload-url")
    fun issueImageUploadUrl(@PathVariable kind: String, @PathVariable id: Long): ShareImageUploadUrlResponse =
        rewardCardShareImageService.issueUploadUrl(myCardToken(kind, id))

    /** 앱이 받은 링크를 열 때. 웹 화면은 같은 내용을 랜딩 HTML 에 실어 받는다. */
    @GetMapping("/api/reward-card-shares/{token}")
    fun sharedCard(@PathVariable token: String): SharedRewardCardResponse =
        rewardCardSharedCardService.find(token) ?: throw BusinessException(ErrorCode.REWARD_CARD_SHARE_NOT_FOUND)

    private fun myCardToken(kind: String, id: Long): String {
        val cardKind = if (kind == "song-cards") RewardCardKind.SONG else RewardCardKind.ARTIST
        val card = rewardCardShareService.issuedCard(currentUserId(), cardKind, id)
        return shareTokens.issue(card.kind, card.cardId)
    }

    private fun currentUserId(): Long =
        SecurityContextHolder.getContext().authentication.principal as Long
}
