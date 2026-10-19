package com.japanese.vocabulary.rewardcard.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.japanese.vocabulary.rewardcard.config.ShareProperties
import com.japanese.vocabulary.rewardcard.dto.SharedRewardCardResponse
import com.japanese.vocabulary.rewardcard.model.RewardCardKind
import org.springframework.stereotype.Service

data class RewardCardLanding(
    val token: String,
    val kind: RewardCardKind,
    val title: String,
    /** 곡 카드의 아티스트 이름. 아티스트 카드는 null. */
    val artist: String?,
    val ownerName: String,
    /** 크롤러가 받아 가도록 https 절대 URL 만 담는다. */
    val imageUrl: String?,
)

/** 카드 웹 화면이 읽는 값. 랜딩 HTML 에 JSON 으로 싣는다. */
data class ShareWebData(
    val card: SharedRewardCardResponse,
    val appUrl: String,
    val iosAppStoreUrl: String,
    val androidPlayUrl: String,
)

@Service
class RewardCardLandingService(
    private val rewardCardSharedCardService: RewardCardSharedCardService,
    private val rewardCardShareImageService: RewardCardShareImageService,
    private val shareWebTemplate: ShareWebTemplate,
    private val shareProperties: ShareProperties,
    private val objectMapper: ObjectMapper,
) {
    /** 없는 카드면 null. */
    fun render(token: String): String? {
        val card = rewardCardSharedCardService.find(token) ?: return null
        val landing = landing(card, rewardCardShareImageService.uploadedUrl(token))
        val template = shareWebTemplate.indexHtml() ?: return RewardCardLandingPage.render(landing, shareProperties)
        val data = ShareWebData(
            card = card,
            appUrl = shareProperties.appUrl(token),
            iosAppStoreUrl = shareProperties.iosAppStoreUrl,
            androidPlayUrl = shareProperties.androidPlayUrl,
        )
        return RewardCardLandingPage.inject(template, landing, shareProperties, objectMapper.writeValueAsString(data))
    }

    private fun landing(card: SharedRewardCardResponse, previewUrl: String?): RewardCardLanding {
        val song = card.songCard
        val artist = card.artistCard
        val title = song?.title ?: artist?.name.orEmpty()
        val artwork = song?.artworkUrl ?: artist?.artworkUrl
        return RewardCardLanding(
            token = card.token,
            kind = card.kind,
            title = title,
            artist = song?.artist,
            ownerName = card.owner.name,
            imageUrl = listOf(previewUrl, artwork).firstOrNull { it != null && it.startsWith("https://") },
        )
    }
}
