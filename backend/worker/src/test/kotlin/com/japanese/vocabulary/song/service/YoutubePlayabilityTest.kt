package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.mvsearch.client.youtube.YoutubePlayability
import com.japanese.vocabulary.mvsearch.client.youtube.YoutubeUnplayable
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeContentDetailsDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeContentRatingDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeRegionRestrictionDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeVideoItemDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeVideoStatusDto
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class YoutubePlayabilityTest {

    @Test
    fun `a public embeddable video with no restriction plays`() {
        assertThat(YoutubePlayability.unplayable(video())).isNull()
    }

    @Test
    fun `an unlisted video plays`() {
        assertThat(YoutubePlayability.unplayable(video(status = YoutubeVideoStatusDto("unlisted", true)))).isNull()
    }

    @Test
    fun `each reason the embedded player refuses is told apart`() {
        assertThat(YoutubePlayability.unplayable(video(rating = "ytAgeRestricted"))).isEqualTo(YoutubeUnplayable.AGE_RESTRICTED)
        assertThat(YoutubePlayability.unplayable(video(status = YoutubeVideoStatusDto("private", true)))).isEqualTo(YoutubeUnplayable.NOT_PUBLIC)
        assertThat(YoutubePlayability.unplayable(video(status = YoutubeVideoStatusDto("public", false)))).isEqualTo(YoutubeUnplayable.NOT_EMBEDDABLE)
    }

    @Test
    fun `a region restriction blocks only when it shuts out Korea`() {
        assertThat(YoutubePlayability.unplayable(video(region = YoutubeRegionRestrictionDto(blocked = listOf("KR")))))
            .isEqualTo(YoutubeUnplayable.REGION_BLOCKED)
        assertThat(YoutubePlayability.unplayable(video(region = YoutubeRegionRestrictionDto(allowed = listOf("JP", "US")))))
            .isEqualTo(YoutubeUnplayable.REGION_BLOCKED)
        assertThat(YoutubePlayability.unplayable(video(region = YoutubeRegionRestrictionDto(blocked = listOf("DE"))))).isNull()
        assertThat(YoutubePlayability.unplayable(video(region = YoutubeRegionRestrictionDto(allowed = listOf("KR", "JP"))))).isNull()
    }

    private fun video(
        rating: String? = null,
        region: YoutubeRegionRestrictionDto? = null,
        status: YoutubeVideoStatusDto = YoutubeVideoStatusDto("public", true),
    ) = YoutubeVideoItemDto(
        id = "x",
        contentDetails = YoutubeContentDetailsDto(
            duration = "PT4M",
            contentRating = rating?.let { YoutubeContentRatingDto(it) },
            regionRestriction = region,
        ),
        status = status,
    )
}
