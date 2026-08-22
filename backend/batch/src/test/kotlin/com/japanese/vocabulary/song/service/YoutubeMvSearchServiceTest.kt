package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.mvsearch.client.youtube.YoutubeClient
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeContentDetailsDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubePlaylistItemDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubePlaylistItemSnippetDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubePlaylistItemsResponse
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeResourceIdDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeSearchItemDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeSearchResponse
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeSnippetDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeThumbnailsDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeVideoIdDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeVideoItemDto
import com.japanese.vocabulary.song.cache.ArtistChannelCache
import com.japanese.vocabulary.song.cache.ArtistChannelCacheEntry
import io.mockk.every
import io.mockk.mockk
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

/**
 * Pure-mock coverage of the Shorts exclusion in [YoutubeMvSearchService]: an upload far
 * shorter than the iTunes track never wins over the full MV, on both the broad-search and
 * cached-uploads paths.
 */
class YoutubeMvSearchServiceTest {

    private val youtubeClient: YoutubeClient = mockk()
    private val artistChannelCache: ArtistChannelCache = mockk(relaxed = true)
    private val service = YoutubeMvSearchService(youtubeClient, artistChannelCache)

    @Test
    fun `search skips a Shorts-length upload and picks the full MV`() {
        every { artistChannelCache.get(ARTIST) } returns null
        stubSearch(
            searchItem("short-id", "$TITLE Official MV"),
            searchItem("mv-id", "$TITLE Music Video"),
        )
        stubDurations("short-id" to "PT58S", "mv-id" to "PT4M13S")

        assertThat(service.searchMvUrl(TITLE, ARTIST, TRACK_SECONDS))
            .isEqualTo("https://www.youtube.com/watch?v=mv-id")
    }

    @Test
    fun `search skips a title tagged as Shorts without a duration lookup`() {
        every { artistChannelCache.get(ARTIST) } returns null
        stubSearch(
            searchItem("tagged-id", "$TITLE Official MV #Shorts"),
            searchItem("mv-id", "$TITLE Music Video"),
        )
        stubDurations("mv-id" to "PT4M13S")

        assertThat(service.searchMvUrl(TITLE, ARTIST, TRACK_SECONDS))
            .isEqualTo("https://www.youtube.com/watch?v=mv-id")
    }

    @Test
    fun `search returns nothing when every candidate is Shorts-length`() {
        every { artistChannelCache.get(ARTIST) } returns null
        stubSearch(searchItem("short-id", "$TITLE Official MV"))
        stubDurations("short-id" to "PT30S")

        assertThat(service.searchMvUrl(TITLE, ARTIST, TRACK_SECONDS)).isNull()
    }

    @Test
    fun `search keeps a candidate when the duration lookup fails`() {
        every { artistChannelCache.get(ARTIST) } returns null
        stubSearch(searchItem("mv-id", "$TITLE Official MV"))
        every { youtubeClient.listVideoContentDetails(any()) } throws
            RuntimeException("403 Forbidden: quota exceeded")

        assertThat(service.searchMvUrl(TITLE, ARTIST, TRACK_SECONDS))
            .isEqualTo("https://www.youtube.com/watch?v=mv-id")
    }

    @Test
    fun `search skips a clip worth half the track length`() {
        every { artistChannelCache.get(ARTIST) } returns null
        stubSearch(
            searchItem("clip-id", "$TITLE Official MV"),
            searchItem("mv-id", "$TITLE Music Video"),
        )
        // 100s clip of a 240s track: too long to be caught by a fixed 60s floor.
        stubDurations("clip-id" to "PT1M40S", "mv-id" to "PT4M13S")

        assertThat(service.searchMvUrl(TITLE, ARTIST, TRACK_SECONDS))
            .isEqualTo("https://www.youtube.com/watch?v=mv-id")
    }

    @Test
    fun `search keeps a video longer than the Shorts length cap even for a long track`() {
        every { artistChannelCache.get(ARTIST) } returns null
        stubSearch(searchItem("edit-id", "$TITLE Official MV"))
        // A 200s video of a 600s track: not a Short, so the cutoff stays clamped at 180s.
        stubDurations("edit-id" to "PT3M20S")

        assertThat(service.searchMvUrl(TITLE, ARTIST, 600))
            .isEqualTo("https://www.youtube.com/watch?v=edit-id")
    }

    @Test
    fun `search falls back to the fixed floor when the track length is unknown`() {
        every { artistChannelCache.get(ARTIST) } returns null
        stubSearch(
            searchItem("short-id", "$TITLE Official MV"),
            searchItem("mv-id", "$TITLE Music Video"),
        )
        stubDurations("short-id" to "PT58S", "mv-id" to "PT2M30S")

        assertThat(service.searchMvUrl(TITLE, ARTIST, null))
            .isEqualTo("https://www.youtube.com/watch?v=mv-id")
    }

    @Test
    fun `cached uploads path skips a Shorts-length upload and picks the full MV`() {
        every { artistChannelCache.get(ARTIST) } returns ArtistChannelCacheEntry(
            artistName = ARTIST,
            channelId = "channel-id",
            uploadsPlaylistId = "uploads-id",
            channelTitle = ARTIST,
        )
        every { youtubeClient.listPlaylistItems(any(), any(), any()) } returns
            YoutubePlaylistItemsResponse(
                nextPageToken = null,
                items = listOf(
                    playlistItem("short-id", "$TITLE Official MV"),
                    playlistItem("mv-id", "$TITLE Music Video"),
                ),
            )
        stubDurations("short-id" to "PT45S", "mv-id" to "PT3M20S")

        assertThat(service.searchMvUrl(TITLE, ARTIST, TRACK_SECONDS))
            .isEqualTo("https://www.youtube.com/watch?v=mv-id")
    }

    private fun stubSearch(vararg items: YoutubeSearchItemDto) {
        every {
            youtubeClient.searchVideos(query = any(), pageToken = any(), maxResults = any(), videoCategoryId = any())
        } returns YoutubeSearchResponse(nextPageToken = null, items = items.toList())
    }

    private fun stubDurations(vararg durations: Pair<String, String>) {
        every { youtubeClient.listVideoContentDetails(any()) } returns durations.map { (videoId, duration) ->
            YoutubeVideoItemDto(
                id = videoId,
                contentDetails = YoutubeContentDetailsDto(duration = duration),
            )
        }
    }

    private fun searchItem(videoId: String, title: String) = YoutubeSearchItemDto(
        id = YoutubeVideoIdDto(videoId = videoId),
        snippet = YoutubeSnippetDto(
            title = title,
            thumbnails = YoutubeThumbnailsDto(medium = null, default = null),
            channelTitle = ARTIST,
            channelId = null,
        ),
    )

    private fun playlistItem(videoId: String, title: String) = YoutubePlaylistItemDto(
        snippet = YoutubePlaylistItemSnippetDto(
            title = title,
            channelTitle = ARTIST,
            resourceId = YoutubeResourceIdDto(videoId = videoId),
        ),
    )

    companion object {
        private const val TITLE = "ももいろの鍵"
        private const val ARTIST = "テストアーティスト"
        private const val TRACK_SECONDS = 240
    }
}
