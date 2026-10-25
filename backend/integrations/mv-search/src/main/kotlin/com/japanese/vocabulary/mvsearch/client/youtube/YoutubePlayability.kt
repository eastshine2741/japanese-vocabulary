package com.japanese.vocabulary.mvsearch.client.youtube

import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeVideoItemDto

/**
 * 앱 임베드 플레이어가 한국에서 재생하지 못하는 이유. 플레이어는 이 경우를 모두 같은 오류(150)로 알려 줘
 * `videos.list` 에서만 구분된다. 삭제된 영상은 응답에서 빠지므로 호출자가 [NOT_FOUND] 로 본다.
 */
enum class YoutubeUnplayable { AGE_RESTRICTED, NOT_EMBEDDABLE, NOT_PUBLIC, REGION_BLOCKED, NOT_FOUND }

object YoutubePlayability {
    // 앱 사용자는 한국에 있다.
    private const val APP_REGION = "KR"

    /** null 이면 재생된다. `part=contentDetails,status` 로 받은 항목이어야 한다. */
    fun unplayable(item: YoutubeVideoItemDto): YoutubeUnplayable? {
        val region = item.contentDetails.regionRestriction
        val privacy = item.status?.privacyStatus
        return when {
            item.contentDetails.contentRating?.ytRating == AGE_RESTRICTED_RATING -> YoutubeUnplayable.AGE_RESTRICTED
            // unlisted 는 링크와 임베드로 재생되고, 공식 MV 가 일부러 unlisted 로 올라오기도 한다.
            privacy != null && privacy != "public" && privacy != "unlisted" -> YoutubeUnplayable.NOT_PUBLIC
            item.status?.embeddable == false -> YoutubeUnplayable.NOT_EMBEDDABLE
            region?.blocked?.contains(APP_REGION) == true -> YoutubeUnplayable.REGION_BLOCKED
            region?.allowed != null && APP_REGION !in region.allowed -> YoutubeUnplayable.REGION_BLOCKED
            else -> null
        }
    }

    private const val AGE_RESTRICTED_RATING = "ytAgeRestricted"
}
