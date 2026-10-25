package com.japanese.vocabulary.song.batch

import com.japanese.vocabulary.mvsearch.client.youtube.YoutubeClient
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeContentDetailsDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeContentRatingDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeVideoItemDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeVideoStatusDto
import com.japanese.vocabulary.song.entity.MvUnavailableReason
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.test.BatchBaseIntegrationTest
import com.japanese.vocabulary.test.fixtures.TestSongBuilder
import com.ninjasquad.springmockk.MockkBean
import io.mockk.every
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.DefaultApplicationArguments

class MvPlayabilityCheckTaskTest : BatchBaseIntegrationTest() {

    @MockkBean private lateinit var youtubeClient: YoutubeClient

    @Autowired private lateinit var task: MvPlayabilityCheckTask

    @Test
    fun `marks age-restricted and removed MVs and clears an MV that plays again`() {
        val age = song("aaaaaaaaaaa")
        val removed = song("bbbbbbbbbbb")
        val back = song("ccccccccccc", reason = MvUnavailableReason.UNAVAILABLE)
        val noMv = song(null)
        every { youtubeClient.listVideoContentDetails(any()) } returns listOf(
            video("aaaaaaaaaaa", rating = "ytAgeRestricted"),
            video("ccccccccccc"),
        )

        task.run(DefaultApplicationArguments())

        assertThat(reload(age).mvUnavailableReason).isEqualTo(MvUnavailableReason.AGE_RESTRICTED)
        assertThat(reload(removed).mvUnavailableReason).isEqualTo(MvUnavailableReason.UNAVAILABLE)
        assertThat(reload(back).mvUnavailableReason).isNull()
        assertThat(reload(noMv).mvUnavailableReason).isNull()
    }

    @Test
    fun `a failed lookup marks nothing`() {
        val song = song("aaaaaaaaaaa")
        every { youtubeClient.listVideoContentDetails(any()) } throws RuntimeException("403 quotaExceeded")

        assertThatThrownBy { task.run(DefaultApplicationArguments()) }.hasMessageContaining("quotaExceeded")
        assertThat(reload(song).mvUnavailableReason).isNull()
    }

    @Test
    fun `changing the MV clears the reason of the old one`() {
        val song = song("aaaaaaaaaaa", reason = MvUnavailableReason.AGE_RESTRICTED)

        song.youtubeUrl = "https://www.youtube.com/watch?v=ddddddddddd"

        assertThat(song.mvUnavailableReason).isNull()
    }

    private fun song(videoId: String?, reason: MvUnavailableReason? = null): SongEntity =
        TestSongBuilder(entityManager).withYoutubeUrl(videoId?.let { "https://www.youtube.com/watch?v=$it" }).build().also {
            it.mvUnavailableReason = reason
            entityManager.flush()
        }

    private fun reload(song: SongEntity): SongEntity {
        entityManager.flush()
        entityManager.clear()
        return entityManager.find(SongEntity::class.java, song.id)
    }

    private fun video(id: String, rating: String? = null) = YoutubeVideoItemDto(
        id = id,
        contentDetails = YoutubeContentDetailsDto(duration = "PT4M", contentRating = rating?.let { YoutubeContentRatingDto(it) }),
        status = YoutubeVideoStatusDto("public", true),
    )
}
