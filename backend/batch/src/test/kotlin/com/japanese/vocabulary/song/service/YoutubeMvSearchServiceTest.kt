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
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

/**
 * Pure-mock coverage of candidate filtering in [YoutubeMvSearchService]: an upload far
 * shorter or longer than the iTunes track, by another artist, or titled as a live/tour clip
 * never wins over the full MV, on both the broad-search and cached-uploads paths. A live clip
 * by the artist is still taken when no MV exists at all.
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
    fun `search skips a video worth half of a long track`() {
        every { artistChannelCache.get(ARTIST) } returns null
        stubSearch(
            searchItem("edit-id", "$TITLE Official MV"),
            searchItem("mv-id", "$TITLE Music Video"),
        )
        // A 200s video of a 600s track is not carrying the whole song, Short or not.
        stubDurations("edit-id" to "PT3M20S", "mv-id" to "PT10M5S")

        assertThat(service.searchMvUrl(TITLE, ARTIST, 600))
            .isEqualTo("https://www.youtube.com/watch?v=mv-id")
    }

    @Test
    fun `search skips a video far longer than the track but keeps a story MV`() {
        every { artistChannelCache.get(ARTIST) } returns null
        stubSearch(
            searchItem("concert-id", "$TITLE Official MV"),
            searchItem("mv-id", "$TITLE Music Video"),
        )
        // 240s track: a 6-minute story MV is fine, a 90-minute concert is not.
        stubDurations("concert-id" to "PT1H30M", "mv-id" to "PT6M")

        assertThat(service.searchMvUrl(TITLE, ARTIST, TRACK_SECONDS))
            .isEqualTo("https://www.youtube.com/watch?v=mv-id")
    }

    @Test
    fun `search does not apply an upper bound when the track length is unknown`() {
        every { artistChannelCache.get(ARTIST) } returns null
        stubSearch(searchItem("long-id", "$TITLE Official MV"))
        stubDurations("long-id" to "PT12M")

        assertThat(service.searchMvUrl(TITLE, ARTIST, null))
            .isEqualTo("https://www.youtube.com/watch?v=long-id")
    }

    @Test
    fun `search prefers the MV over a same-length live clip from the artist channel`() {
        every { artistChannelCache.get(ARTIST) } returns null
        stubSearch(
            searchItem("live-id", "$ARTIST - $TITLE ($ARTIST CEN+RAL Tour 2026 at TOKYO ARENA)"),
            searchItem("mv-id", "$ARTIST - $TITLE"),
        )
        stubDurations("live-id" to "PT3M58S", "mv-id" to "PT3M58S")

        assertThat(service.searchMvUrl(TITLE, ARTIST, TRACK_SECONDS))
            .isEqualTo("https://www.youtube.com/watch?v=mv-id")
    }

    @Test
    fun `search returns a live clip from the artist channel when no MV exists`() {
        // Prod song 93: "灯火 / Vaundy" has no MV, only live uploads. Failing the work there
        // is worse than a live performance of the song by the artist.
        every { artistChannelCache.get(ARTIST) } returns null
        stubSearch(
            searchItem("live-id", "$TITLE LIVE映像"),
            searchItem("live-en-id", "$TITLE Live at Budokan"),
            searchItem("karaoke-id", "【カラオケ】$TITLE / $ARTIST"),
        )
        stubDurations("live-id" to "PT4M", "live-en-id" to "PT4M", "karaoke-id" to "PT4M")

        assertThat(service.searchMvUrl(TITLE, ARTIST, TRACK_SECONDS))
            .isEqualTo("https://www.youtube.com/watch?v=live-id")
    }

    @Test
    fun `search rejects a Shorts-length live clip`() {
        every { artistChannelCache.get(ARTIST) } returns null
        stubSearch(searchItem("live-id", "$TITLE LIVE映像"))
        stubDurations("live-id" to "PT57S")

        assertThat(service.searchMvUrl(TITLE, ARTIST, TRACK_SECONDS)).isNull()
    }

    @Test
    fun `search returns nothing when every candidate is a cover or a karaoke track`() {
        every { artistChannelCache.get(ARTIST) } returns null
        stubSearch(
            searchItem("karaoke-id", "【カラオケ】$TITLE / $ARTIST"),
            searchItem("cover-id", "$TITLE / $ARTIST【歌ってみた】", "歌い手ちゃん"),
            searchItem("live-cover-id", "$TITLE $ARTIST cover LIVE", "弾き語りチャンネル"),
        )
        stubDurations("karaoke-id" to "PT4M", "cover-id" to "PT4M", "live-cover-id" to "PT4M")

        assertThat(service.searchMvUrl(TITLE, ARTIST, TRACK_SECONDS)).isNull()
    }

    @Test
    fun `search rejects a same-titled song by another artist`() {
        // Prod song 93: "優河 - 灯火（Official Music Video）" won the search for "灯火 / Vaundy"
        // on the official marker alone, and cached 優河's channel under Vaundy.
        every { artistChannelCache.get("Vaundy") } returns null
        stubSearch(
            searchItem("other-artist-id", "優河 -  灯火（Official Music Video）", "優河 Yuga", "yuga-channel"),
            searchItem("short-id", "#灯火 / #Vaundy", "Vaundy"),
        )
        stubDurations("other-artist-id" to "PT5M12S", "short-id" to "PT40S")

        assertThat(service.searchMvUrl("灯火", "Vaundy", 178)).isNull()
        verify(exactly = 0) { artistChannelCache.put(any<String>(), any<ArtistChannelCacheEntry>()) }
    }

    @Test
    fun `search prefers the artist's live over a reupload on a stranger's channel`() {
        // The full "灯火 / Vaundy" search result: no MV exists, so behind 優河's same-titled MV
        // sit a bootleg audio reupload, a cut-down official audio, and the Budokan live.
        every { artistChannelCache.get("Vaundy") } returns null
        stubSearch(
            searchItem("other-artist-id", "優河 -  灯火（Official Music Video）", "優河 Yuga"),
            searchItem("reupload-id", "Vaundy - 灯火", "音楽音楽"),
            searchItem("short-ver-id", "灯火 / Vaundy ：Official Audio(Short Version)", "Vaundy"),
            searchItem("live-id", "Vaundy LIVE \"灯火\" | 2022.09.09 one man live at BUDOKAN", "Vaundy"),
        )
        stubDurations(
            "other-artist-id" to "PT3M40S",
            "reupload-id" to "PT2M57S",
            "short-ver-id" to "PT1M52S",
            "live-id" to "PT3M9S",
        )

        assertThat(service.searchMvUrl("灯火", "Vaundy", 178))
            .isEqualTo("https://www.youtube.com/watch?v=live-id")
    }

    @Test
    fun `search accepts a reupload on a stranger's channel when nothing official is found`() {
        every { artistChannelCache.get(ARTIST) } returns null
        stubSearch(searchItem("reupload-id", "$ARTIST - $TITLE", "音楽音楽"))
        stubDurations("reupload-id" to "PT3M58S")

        assertThat(service.searchMvUrl(TITLE, ARTIST, TRACK_SECONDS))
            .isEqualTo("https://www.youtube.com/watch?v=reupload-id")
    }

    @Test
    fun `search matches either half of a bilingual iTunes title`() {
        every { artistChannelCache.get(ARTIST) } returns null
        stubSearch(
            searchItem("jp-id", "米津玄師 - ピースサイン , Kenshi Yonezu - Peace Sign"),
            searchItem("unrelated-id", "米津玄師 - Lemon"),
        )
        stubDurations("jp-id" to "PT4M3S", "unrelated-id" to "PT4M15S")

        assertThat(service.searchMvUrl("ピースサイン - Peace Sign", ARTIST, 237))
            .isEqualTo("https://www.youtube.com/watch?v=jp-id")
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

    @Test
    fun `cached uploads path falls through to search when its only match is a live clip`() {
        every { artistChannelCache.get(ARTIST) } returns ArtistChannelCacheEntry(
            artistName = ARTIST,
            channelId = "channel-id",
            uploadsPlaylistId = "uploads-id",
            channelTitle = ARTIST,
        )
        every { youtubeClient.listPlaylistItems(any(), any(), any()) } returns
            YoutubePlaylistItemsResponse(
                nextPageToken = null,
                items = listOf(playlistItem("live-id", "\"$ARTIST Tour 2026\" $TITLE in Hong Kong")),
            )
        stubSearch(searchItem("mv-id", "$TITLE Music Video"))
        stubDurations("live-id" to "PT1M8S", "mv-id" to "PT3M58S")

        assertThat(service.searchMvUrl(TITLE, ARTIST, null))
            .isEqualTo("https://www.youtube.com/watch?v=mv-id")
    }

    @Test
    fun `cached uploads path returns a live upload when the search finds no MV`() {
        every { artistChannelCache.get(ARTIST) } returns ArtistChannelCacheEntry(
            artistName = ARTIST,
            channelId = "channel-id",
            uploadsPlaylistId = "uploads-id",
            channelTitle = ARTIST,
        )
        every { youtubeClient.listPlaylistItems(any(), any(), any()) } returns
            YoutubePlaylistItemsResponse(
                nextPageToken = null,
                items = listOf(playlistItem("live-id", "$TITLE / $ARTIST (Live at Budokan)")),
            )
        stubSearch()
        stubDurations("live-id" to "PT4M2S")

        assertThat(service.searchMvUrl(TITLE, ARTIST, TRACK_SECONDS))
            .isEqualTo("https://www.youtube.com/watch?v=live-id")
    }

    @Test
    fun `cached publisher channel rejects an upload of the song by another unit`() {
        // Prod song 78: the Project SEKAI channel's recent uploads held only the April Fools
        // swap "熱異常 / ロボピース", and the real "熱異常 / 25時、ナイトコードで。 × KAITO" was
        // older than the scanned pages; the swap must not win by title alone.
        every { artistChannelCache.get(NIIGO) } returns ArtistChannelCacheEntry(
            artistName = NIIGO,
            channelId = "channel-id",
            uploadsPlaylistId = "uploads-id",
            channelTitle = PUBLISHER_CHANNEL,
        )
        every { youtubeClient.listPlaylistItems(any(), any(), any()) } returns
            YoutubePlaylistItemsResponse(
                nextPageToken = null,
                items = listOf(playlistItem("swap-id", "熱異常 / ロボピース", PUBLISHER_CHANNEL)),
            )
        stubSearch(searchItem("mv-id", "熱異常 / $NIIGO × KAITO", PUBLISHER_CHANNEL))
        stubDurations("swap-id" to "PT2M5S", "mv-id" to "PT4M1S")

        assertThat(service.searchMvUrl(NIIGO_TITLE, NIIGO, 241))
            .isEqualTo("https://www.youtube.com/watch?v=mv-id")
    }

    @Test
    fun `cached publisher channel picks the upload that names the artist`() {
        every { artistChannelCache.get(NIIGO) } returns ArtistChannelCacheEntry(
            artistName = NIIGO,
            channelId = "channel-id",
            uploadsPlaylistId = "uploads-id",
            channelTitle = PUBLISHER_CHANNEL,
        )
        every { youtubeClient.listPlaylistItems(any(), any(), any()) } returns
            YoutubePlaylistItemsResponse(
                nextPageToken = null,
                items = listOf(
                    playlistItem("swap-id", "熱異常 / ロボピース", PUBLISHER_CHANNEL),
                    playlistItem("mv-id", "熱異常 / $NIIGO × KAITO", PUBLISHER_CHANNEL),
                ),
            )
        stubDurations("swap-id" to "PT2M5S", "mv-id" to "PT4M1S")

        assertThat(service.searchMvUrl(NIIGO_TITLE, NIIGO, 241))
            .isEqualTo("https://www.youtube.com/watch?v=mv-id")
    }

    @Test
    fun `cached artist channel does not require the artist name in the title`() {
        every { artistChannelCache.get(ARTIST) } returns ArtistChannelCacheEntry(
            artistName = ARTIST,
            channelId = "channel-id",
            uploadsPlaylistId = "uploads-id",
            channelTitle = "$ARTIST Official YouTube Channel",
        )
        every { youtubeClient.listPlaylistItems(any(), any(), any()) } returns
            YoutubePlaylistItemsResponse(
                nextPageToken = null,
                items = listOf(playlistItem("mv-id", "$TITLE Music Video")),
            )
        stubDurations("mv-id" to "PT4M1S")

        assertThat(service.searchMvUrl(TITLE, ARTIST, TRACK_SECONDS))
            .isEqualTo("https://www.youtube.com/watch?v=mv-id")
    }

    @Test
    fun `search penalizes an April Fools version below the original`() {
        every { artistChannelCache.get(NIIGO) } returns null
        stubSearch(
            searchItem("swap-id", "【エイプリルフールver.】熱異常 / ロボピース", PUBLISHER_CHANNEL),
            searchItem("mv-id", "熱異常 / $NIIGO × KAITO", PUBLISHER_CHANNEL),
        )
        stubDurations("swap-id" to "PT2M5S", "mv-id" to "PT4M1S")

        assertThat(service.searchMvUrl(NIIGO_TITLE, NIIGO, 241))
            .isEqualTo("https://www.youtube.com/watch?v=mv-id")
    }

    @Test
    fun `search rejects an unofficial fan MV and falls back to the Topic channel`() {
        // Prod song 79: "【非公式MV】エンゼルケア / いよわ様" scored as official because "非公式"
        // contains "公式", won over the Topic upload, and cached its channel for the artist.
        every { artistChannelCache.get("いよわ") } returns null
        stubSearch(
            searchItem("fan-id", "【非公式MV】エンゼルケア / いよわ様", "ふわふわ擬"),
            searchItem("topic-id", "エンゼルケア", "Iyowa - Topic"),
        )
        stubDurations("fan-id" to "PT3M45S", "topic-id" to "PT3M50S")

        assertThat(service.searchMvUrl("エンゼルケア", "いよわ", 229))
            .isEqualTo("https://www.youtube.com/watch?v=topic-id")
        verify(exactly = 0) { artistChannelCache.put(any<String>(), any<ArtistChannelCacheEntry>()) }
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

    private fun searchItem(
        videoId: String,
        title: String,
        channelTitle: String = ARTIST,
        channelId: String? = null,
    ) = YoutubeSearchItemDto(
        id = YoutubeVideoIdDto(videoId = videoId),
        snippet = YoutubeSnippetDto(
            title = title,
            thumbnails = YoutubeThumbnailsDto(medium = null, default = null),
            channelTitle = channelTitle,
            channelId = channelId,
        ),
    )

    private fun playlistItem(videoId: String, title: String, channelTitle: String = ARTIST) = YoutubePlaylistItemDto(
        snippet = YoutubePlaylistItemSnippetDto(
            title = title,
            channelTitle = channelTitle,
            resourceId = YoutubeResourceIdDto(videoId = videoId),
        ),
    )

    companion object {
        private const val TITLE = "ももいろの鍵"
        private const val ARTIST = "テストアーティスト"
        private const val TRACK_SECONDS = 240
        private const val NIIGO = "25時、ナイトコードで。"
        private const val NIIGO_TITLE = "熱異常 (feat. 宵崎奏, 朝比奈まふゆ, 東雲絵名, 暁山瑞希 & KAITO)"
        private const val PUBLISHER_CHANNEL = "プロジェクトセカイ カラフルステージ! feat. 初音ミク"
    }
}
