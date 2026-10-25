package com.japanese.vocabulary.mvsearch.client.youtube.dto

data class YoutubeContentDetailsDto(
    val duration: String,
    val contentRating: YoutubeContentRatingDto? = null,
    val regionRestriction: YoutubeRegionRestrictionDto? = null,
)

data class YoutubeContentRatingDto(
    /** `ytAgeRestricted` 면 로그인한 성인만 볼 수 있고 임베드 플레이어는 재생하지 않는다. */
    val ytRating: String? = null,
)

/** `allowed` 가 있으면 그 나라에서만, `blocked` 가 있으면 그 나라를 빼고 재생된다. */
data class YoutubeRegionRestrictionDto(
    val allowed: List<String>? = null,
    val blocked: List<String>? = null,
)
