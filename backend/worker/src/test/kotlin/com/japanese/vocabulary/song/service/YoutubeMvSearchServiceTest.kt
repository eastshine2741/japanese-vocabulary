package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.mvsearch.client.youtube.YoutubeClient
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeContentDetailsDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeContentRatingDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubePlaylistItemDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubePlaylistItemSnippetDto
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubePlaylistItemsResponse
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeRegionRestrictionDto
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
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test

/**
 * Pure-mock coverage of candidate filtering in [YoutubeMvSearchService]: an upload far
 * shorter or longer than the catalog track, by another artist, or titled as a live/tour clip
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
    fun `search skips an MV the app cannot play and traces why`() {
        every { artistChannelCache.get(ARTIST) } returns null
        stubSearch(
            searchItem("age-id", "$TITLE Official MV"),
            searchItem("mv-id", "$TITLE Music Video"),
        )
        every { youtubeClient.listVideoContentDetails(any()) } returns listOf(
            YoutubeVideoItemDto(
                id = "age-id",
                contentDetails = YoutubeContentDetailsDto(duration = "PT4M13S", contentRating = YoutubeContentRatingDto(ytRating = "ytAgeRestricted")),
            ),
            YoutubeVideoItemDto(id = "mv-id", contentDetails = YoutubeContentDetailsDto(duration = "PT4M13S")),
        )

        val result = service.search(TITLE, ARTIST, TRACK_SECONDS)

        assertThat(result.url).isEqualTo("https://www.youtube.com/watch?v=mv-id")
        assertThat(result.candidates.single { it.videoId == "age-id" }.rejection).isEqualTo("unplayable:AGE_RESTRICTED")
    }

    @Test
    fun `search returns nothing rather than an MV blocked in Korea`() {
        every { artistChannelCache.get(ARTIST) } returns null
        stubSearch(searchItem("mv-id", "$TITLE Official MV"))
        every { youtubeClient.listVideoContentDetails(any()) } returns listOf(
            YoutubeVideoItemDto(
                id = "mv-id",
                contentDetails = YoutubeContentDetailsDto(duration = "PT4M13S", regionRestriction = YoutubeRegionRestrictionDto(allowed = listOf("JP"))),
            ),
        )

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
        // No MV, only live uploads: the artist's live beats failing the work.
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
    fun `search keeps an utaite's own cover upload`() {
        every { artistChannelCache.get("まふまふ") } returns null
        stubSearch(
            searchItem("own-id", "$TITLE 歌ってみた【まふまふ】", "まふまふちゃんねる"),
            searchItem("other-id", "$TITLE 歌ってみた", "歌い手"),
        )
        stubDurations("own-id" to "PT4M", "other-id" to "PT4M")

        assertThat(service.searchMvUrl(TITLE, "まふまふ", TRACK_SECONDS)).isEqualTo("https://www.youtube.com/watch?v=own-id")
    }

    @Test
    fun `search rejects a same-titled song by another artist`() {
        // The official marker alone must not let another artist's same-titled MV win or be cached.
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
        // No MV exists: behind the other artist's same-titled MV sit a reupload, a cut-down audio, and the live.
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
    fun `a reupload on a stranger's channel is never taken, even when nothing else is found`() {
        every { artistChannelCache.get(ARTIST) } returns null
        stubSearch(searchItem("reupload-id", "$ARTIST - $TITLE", "音楽音楽"))
        stubDurations("reupload-id" to "PT3M58S")

        assertThat(service.searchMvUrl(TITLE, ARTIST, TRACK_SECONDS)).isNull()
    }

    @Test
    fun `the current MV is kept when it would pass as the only candidate`() {
        stubVideo("mv-id", "$TITLE Official MV", channelTitle = ARTIST, duration = "PT4M")

        assertThat(service.acceptsAsOnlyCandidate("mv-id", TITLE, ARTIST, TRACK_SECONDS)).isTrue()
    }

    @Test
    fun `the current MV is dropped when it is a stranger's reupload, a reaction, or gone`() {
        stubVideo("reupload-id", "$ARTIST - $TITLE", channelTitle = "音楽音楽", duration = "PT4M")
        stubVideo("reaction-id", "$TITLE Official MV reaction", channelTitle = ARTIST, duration = "PT4M")
        every { youtubeClient.getVideo("gone-id") } returns null

        assertThat(service.acceptsAsOnlyCandidate("reupload-id", TITLE, ARTIST, TRACK_SECONDS)).isFalse()
        assertThat(service.acceptsAsOnlyCandidate("reaction-id", TITLE, ARTIST, TRACK_SECONDS)).isFalse()
        assertThat(service.acceptsAsOnlyCandidate("gone-id", TITLE, ARTIST, TRACK_SECONDS)).isFalse()
    }

    @Test
    fun `an artist's own channel under a romanized name counts as official`() {
        stubVideo("inaba-id", "稲葉曇『ラグトレイン』Vo. 歌愛ユキ", channelTitle = "inabakumori", duration = "PT3M")
        stubVideo("yukopi-id", "カニを求めて", channelTitle = "Yukopi", duration = "PT3M")
        stubVideo("hiiragi-id", "雑魚 / 柊マグネタイト", channelTitle = "Hiiragi Magnetite", duration = "PT3M")
        stubVideo("cosmo-id", "ヤミナベ!!!! - cosMo＠暴走P feat.初音ミク", channelTitle = "cosMo@bousouP Official Channel", duration = "PT3M")

        assertThat(service.acceptsAsOnlyCandidate("inaba-id", "ラグトレイン", "稲葉曇", 180)).isTrue()
        assertThat(service.acceptsAsOnlyCandidate("yukopi-id", "カニを求めて", "ゆこぴ", 180)).isTrue()
        assertThat(service.acceptsAsOnlyCandidate("hiiragi-id", "雑魚", "柊マグネタイト", 180)).isTrue()
        assertThat(service.acceptsAsOnlyCandidate("cosmo-id", "ヤミナベ!!!!", "cosMo@暴走P", 180)).isTrue()
    }

    @Test
    fun `a fan channel carrying the romanized name plus other words is not the artist's own`() {
        stubVideo(
            "fan-id", "米津玄師「メランコリーキッチン」- Kenshi Yonezu （Melancholy Kitchen） - （Türkçe Çeviri + 日本語 + Romaji）",
            channelTitle = "Kenshi Yonezu fanTR", duration = "PT4M",
        )
        stubVideo("remake-id", "強風オールバック / ゆこぴ（1982年）", channelTitle = "The Night Jukebox", duration = "PT3M")

        assertThat(service.acceptsAsOnlyCandidate("fan-id", "メランコリーキッチン", "米津玄師", 240)).isFalse()
        assertThat(service.acceptsAsOnlyCandidate("remake-id", "強風オールバック", "ゆこぴ", 180)).isFalse()
    }

    @Test
    fun `an upload on a channel listed for the artist is the MV even when neither title nor channel names the artist`() {
        every { artistChannelCache.get(any()) } returns null
        stubSearch(searchItem("ll-id", "Sing！Shine！Smile！", "ラブライブ!スーパースター!!", channelId = LIELLA_CHANNEL_ID))
        stubDurations("ll-id" to "PT4M")
        every { youtubeClient.getChannel(any()) } returns null

        assertThat(service.searchMvUrl("Sing!Shine!Smile!", "Aqours", 240)).isNull()
        assertThat(service.searchMvUrl("Sing!Shine!Smile!", "Liella!", 240)).isEqualTo("https://www.youtube.com/watch?v=ll-id")
    }

    @Test
    fun `the cached uploads path knows the mapped channel from the playlist owner`() {
        every { artistChannelCache.get("Liella!") } returns
            ArtistChannelCacheEntry("Liella!", LIELLA_CHANNEL_ID, "UULLSUPERSTAR0000000000", "ラブライブ!スーパースター!!")
        every { youtubeClient.listPlaylistItems(any(), any(), any()) } returns YoutubePlaylistItemsResponse(
            nextPageToken = null,
            items = listOf(
                YoutubePlaylistItemDto(
                    snippet = YoutubePlaylistItemSnippetDto(
                        title = "POP TALKING",
                        channelTitle = "ラブライブ!スーパースター!!",
                        resourceId = YoutubeResourceIdDto(videoId = "pop-id"),
                        channelId = LIELLA_CHANNEL_ID,
                    ),
                ),
            ),
        )
        stubDurations("pop-id" to "PT4M")

        assertThat(service.searchMvUrl("POP TALKING", "Liella!", 240))
            .isEqualTo("https://www.youtube.com/watch?v=pop-id")
    }

    @Test
    fun `a current MV on a listed channel is kept`() {
        every { youtubeClient.getVideo("ll-id") } returns YoutubeVideoItemDto(
            id = "ll-id",
            contentDetails = YoutubeContentDetailsDto(duration = "PT4M"),
            snippet = searchItem("ll-id", "Starlight Prologue", "ラブライブ!スーパースター!!", channelId = LIELLA_CHANNEL_ID).snippet,
        )

        assertThat(service.acceptsAsOnlyCandidate("ll-id", "Starlight Prologue", "Aqours", 240)).isFalse()
        assertThat(service.acceptsAsOnlyCandidate("ll-id", "Starlight Prologue", "Liella!", 240)).isTrue()
    }

    @Test
    fun `a label channel's upload naming the artist is official`() {
        stubVideo("smtown-id", "Red Velvet レッドベルベット 'WILDSIDE' MV", channelTitle = "SMTOWN", duration = "PT3M30S")

        assertThat(service.acceptsAsOnlyCandidate("smtown-id", "WILDSIDE", "Red Velvet", 210)).isTrue()
    }

    @Test
    fun `the current MV is dropped when the app cannot play it`() {
        stubVideo(
            "age-id", "$TITLE Official MV", channelTitle = ARTIST, duration = "PT4M",
            contentRating = YoutubeContentRatingDto(ytRating = "ytAgeRestricted"),
        )

        assertThat(service.acceptsAsOnlyCandidate("age-id", TITLE, ARTIST, TRACK_SECONDS)).isFalse()
    }

    @Test
    fun `a YouTube error while judging the current MV propagates instead of dropping it`() {
        every { youtubeClient.getVideo("mv-id") } throws RuntimeException("503 Service Unavailable")

        assertThatThrownBy { service.acceptsAsOnlyCandidate("mv-id", TITLE, ARTIST, TRACK_SECONDS) }
            .isInstanceOf(RuntimeException::class.java)
    }

    @Test
    fun `search matches either half of a bilingual catalog title`() {
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
        // The real MV is older than the scanned pages; the April Fools swap must not win by title alone.
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
        // "非公式" contains "公式" and must not score as official over the Topic upload.
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

    @Test
    fun `search retries by view count when the relevance search returns nothing`() {
        // YouTube's relevance search returns zero results for "少女レイ みきとP"; the view-count ranking does not.
        every { artistChannelCache.get("みきとP") } returns null
        every {
            youtubeClient.searchVideos(query = any(), pageToken = any(), maxResults = any(), videoCategoryId = any(), order = null)
        } returns YoutubeSearchResponse(nextPageToken = null, items = emptyList())
        every {
            youtubeClient.searchVideos(query = any(), pageToken = any(), maxResults = any(), videoCategoryId = any(), order = "viewCount")
        } returns YoutubeSearchResponse(
            nextPageToken = null,
            items = listOf(searchItem("mv-id", "みきとP 『 少女レイ 』 MV", "みきとP mikitoP OFFICIAL")),
        )
        stubDurations("mv-id" to "PT4M50S")

        assertThat(service.searchMvUrl("少女レイ", "みきとP", 289))
            .isEqualTo("https://www.youtube.com/watch?v=mv-id")
    }

    @Test
    fun `search accepts a collaboration's upload on one member's channel`() {
        every { artistChannelCache.get("niki & リリィ") } returns null
        stubSearch(searchItem("mv-id", "ERROR / niki feat.Lily", "niki official"))
        stubDurations("mv-id" to "PT3M55S")

        assertThat(service.searchMvUrl("ERROR", "niki & リリィ", 238))
            .isEqualTo("https://www.youtube.com/watch?v=mv-id")
    }

    @Test
    fun `search takes the artist's official lyric video when the song has no MV`() {
        every { artistChannelCache.get("Mrs. GREEN APPLE") } returns null
        stubSearch(
            searchItem("fan-lyrics-id", "Mrs. GREEN APPLE-ProPose(Lyrics kanji,romaji,eng)", "BlackCloud"),
            searchItem("live-id", "Mrs. GREEN APPLE - ProPose 【LIVE from M-ON!】", "ミセス好き"),
            searchItem("lyric-id", "Mrs. GREEN APPLE「ProPose」Official Lyric Video", "Mrs. GREEN APPLE"),
        )
        stubDurations("fan-lyrics-id" to "PT3M16S", "live-id" to "PT3M41S", "lyric-id" to "PT3M20S")

        assertThat(service.searchMvUrl("ProPose", "Mrs. GREEN APPLE", 197))
            .isEqualTo("https://www.youtube.com/watch?v=lyric-id")
    }

    @Test
    fun `search rejects a fan video captioned with lyrics`() {
        every { artistChannelCache.get("なとり") } returns null
        stubSearch(searchItem("fan-id", "【なとり - 絶対零度】TVアニメWIND BREAKER OP / 歌詞", "tsu ki"))
        stubDurations("fan-id" to "PT3M19S")

        assertThat(service.searchMvUrl("絶対零度", "なとり", 198)).isNull()
    }

    @Test
    fun `search skips an off-vocal Topic upload for the vocal one`() {
        every { artistChannelCache.get("みらくらぱーく!") } returns null
        stubSearch(
            searchItem("off-vocal-id", "ファンファーレ！！！ (Off Vocal)", "Mira-Cra Park！ - Topic"),
            searchItem("topic-id", "ファンファーレ！！！", "Release - Topic"),
        )
        stubDurations("off-vocal-id" to "PT3M23S", "topic-id" to "PT3M22S")

        assertThat(service.searchMvUrl("ファンファーレ!!!", "みらくらぱーく!", 202))
            .isEqualTo("https://www.youtube.com/watch?v=topic-id")
    }

    @Test
    fun `search takes the Topic upload of a song whose own title holds a bad-title word`() {
        every { artistChannelCache.get("結束バンド") } returns null
        stubSearch(searchItem("topic-id", "ギターと孤独と蒼い惑星", "kessoku band - Topic"))
        stubDurations("topic-id" to "PT3M48S")

        assertThat(service.searchMvUrl("ギターと孤独と蒼い惑星", "結束バンド", 228))
            .isEqualTo("https://www.youtube.com/watch?v=topic-id")
    }

    @Test
    fun `search rejects fan subs, dance practices, game plays, trailers and karaoke that play other audio`() {
        every { artistChannelCache.get(ARTIST) } returns null
        stubSearch(
            searchItem("subbed-id", "【中文翻譯】$ARTIST - $TITLE（再見，莫頓）", "安安日本語"),
            searchItem("thai-sub-id", "[Thai sub] $TITLE / $ARTIST", "タケル : $ARTIST"),
            searchItem("practice-id", "$ARTIST '$TITLE' Dance Practice"),
            searchItem("game-id", "【D4DJ/グルミク】$TITLE / $ARTIST [PFC(MAX-6)]", "からむちょ"),
            searchItem("chart-id", "【Sonolusプロセカ創作譜面】$TITLE ／ $ARTIST（MASTER Lv.29）", "さとちゃ"),
            searchItem("offvocal-id", "$ARTIST- $TITLE　Offvocal", "左脳ふぁんえむ"),
            searchItem("key-id", "$TITLE -2Key (原曲歌手:$ARTIST)", "歌っちゃ王 - Topic"),
            searchItem("trailer-id", "$ARTIST - $TITLE (Album Trailer)"),
            searchItem("clip-id", "【$ARTIST】${TITLE}を歌ったキッカケ【切り抜き】", "${ARTIST}センス"),
            searchItem("drum-id", "【ドラムのみ】$TITLE／$ARTIST", "Youichi Watanabe"),
            searchItem("reaction-id", "Musician Reacts to $ARTIST - '$TITLE' M/V", "Velo City"),
            searchItem("mashup-id", "『$TITLE』×『KING』"),
        )
        stubDurations(
            "subbed-id" to "PT4M", "thai-sub-id" to "PT4M", "practice-id" to "PT4M", "game-id" to "PT2M30S",
            "chart-id" to "PT2M15S", "offvocal-id" to "PT4M", "key-id" to "PT4M", "trailer-id" to "PT4M",
            "clip-id" to "PT2M30S", "drum-id" to "PT4M", "reaction-id" to "PT5M", "mashup-id" to "PT2M30S",
        )

        assertThat(service.searchMvUrl(TITLE, ARTIST, TRACK_SECONDS)).isNull()
    }

    @Test
    fun `a Japanese version song rejects the Korean MV and dance practice for the Japanese MV`() {
        every { artistChannelCache.get("ATEEZ") } returns null
        stubSearch(
            searchItem("korean-id", "ATEEZ(에이티즈) - ‘야간비행 (Turbulence)’ Official MV", "KQ ENTERTAINMENT"),
            searchItem("practice-id", "ATEEZ 'Turbulence' Dance Practice", "ATEEZ"),
            searchItem("japanese-id", "ATEEZ(에이티즈) - '야간비행 (Turbulence) (Japanese Ver.)' Official MV", "KQ ENTERTAINMENT"),
        )
        stubDurations("korean-id" to "PT3M34S", "practice-id" to "PT3M30S", "japanese-id" to "PT3M30S")

        val result = service.search("야간비행 (Turbulence) [Japanese Ver.]", "ATEEZ", 201)

        assertThat(result.url).isEqualTo("https://www.youtube.com/watch?v=japanese-id")
        assertThat(result.candidates.single { it.videoId == "korean-id" }.rejection).isEqualTo("version-mismatch")
    }

    @Test
    fun `a plain song title rejects its English version MV`() {
        every { artistChannelCache.get("YOASOBI") } returns null
        stubSearch(
            searchItem("english-id", "YOASOBI / UNDEAD (English Version) Official Music Video", "YOASOBI"),
            searchItem("mv-id", "YOASOBI「UNDEAD」Official Music Video", "YOASOBI"),
        )
        stubDurations("english-id" to "PT3M6S", "mv-id" to "PT3M5S")

        assertThat(service.searchMvUrl("UNDEAD", "YOASOBI", 182))
            .isEqualTo("https://www.youtube.com/watch?v=mv-id")
    }

    @Test
    fun `a movie edit song rejects the full-length audio`() {
        every { artistChannelCache.get("RADWIMPS") } returns null
        stubSearch(searchItem("full-id", "RADWIMPS - グランドエスケープ [Audio]", "RADWIMPS"))
        stubDurations("full-id" to "PT5M38S")

        assertThat(service.searchMvUrl("グランドエスケープ (feat. 三浦透子) [Movie edit]", "RADWIMPS", 188)).isNull()
    }

    @Test
    fun `a festival clip on a stranger's channel is a live take, not a reupload`() {
        every { artistChannelCache.get("藤井 風") } returns null
        stubSearch(
            searchItem("fes-id", "藤井風「死ぬのがいいわ」@Fuji Rock Fes2026, Fujii Kaze", "ミッキーチャンネル"),
            searchItem("rock-id", "藤井風「死ぬのがいいわ」Fujii Kaze, Fuji rock 2026", "ミッキーチャンネル"),
        )
        stubDurations("fes-id" to "PT3M58S", "rock-id" to "PT3M58S")

        assertThat(service.searchMvUrl("死ぬのがいいわ", "藤井 風", 199)).isNull()
    }

    @Test
    fun `a short song title must stand alone in the upload title`() {
        every { artistChannelCache.get("Guiano") } returns null
        stubSearch(searchItem("other-song-id", "Guiano - 花火", "Guiano"))
        stubDurations("other-song-id" to "PT4M3S")

        assertThat(service.searchMvUrl("花", "Guiano", 210)).isNull()
    }

    @Test
    fun `a short song title with punctuation still matches its upload`() {
        every { artistChannelCache.get(NIIGO) } returns null
        stubSearch(searchItem("mv-id", "D/N/A / 25時、ナイトコードで。 × 鏡音リン", PUBLISHER_CHANNEL))
        stubDurations("mv-id" to "PT3M30S")

        assertThat(service.searchMvUrl("D/N/A (feat. 宵崎奏 & 鏡音リン)", NIIGO, 210))
            .isEqualTo("https://www.youtube.com/watch?v=mv-id")
    }

    @Test
    fun `a one-character artist still matches its own channel`() {
        every { artistChannelCache.get("嵐") } returns null
        stubSearch(searchItem("mv-id", TITLE, "嵐 ARASHI"))
        stubDurations("mv-id" to "PT4M")

        assertThat(service.searchMvUrl(TITLE, "嵐", TRACK_SECONDS))
            .isEqualTo("https://www.youtube.com/watch?v=mv-id")
    }

    @Test
    fun `a featured singer's channel is not the producer's own channel`() {
        every { artistChannelCache.get("DECO*27 feat. 初音ミク") } returns null
        stubSearch(searchItem("other-id", "$TITLE / 初音ミク", "初音ミク"))
        stubDurations("other-id" to "PT4M")

        assertThat(service.searchMvUrl(TITLE, "DECO*27 feat. 初音ミク", TRACK_SECONDS)).isNull()
        verify(exactly = 0) { artistChannelCache.put(any<String>(), any<ArtistChannelCacheEntry>()) }
    }

    @Test
    fun `a kana artist's romanized channel is the artist's own channel`() {
        every { artistChannelCache.get("ゆこぴ") } returns null
        stubSearch(
            searchItem("DkTLQhB8wfc", "【ライブ音響🔈】Yokopi-私の歯医者さん　#yukopi #ライブ音響 #私の歯医者さん #ボカロ曲 #shorts", "rumaのライブ音響"),
            searchItem("FDPeqBUySik", "Yukopi - 私の歯医者さん (feat. 歌愛ユキ)", "Yukopi"),
            searchItem("5R3Ny4l2EJg", "Yukopi - 私の歯医者さん  (feat.黒井しば)", "Yukopi"),
            searchItem("YqKfOkat870", "私の歯医者さん", "Yukopi"),
            searchItem("_VWZ_8Jrr0E", "〈UTAUカバー〉私の歯医者さん / こちぇ", "星."),
            searchItem("fCT831UD1II", "【手描きRKRN】私の歯医者さん【保健委員会】", "生肉人"),
            searchItem("tqo03d5mlCs", "【ドレミ楽譜】ゆこぴ「私の歯医者さん」の間奏だけ【易★☆☆☆☆難】", "だけドレミ"),
            searchItem("EbHy29Z0Llk", "【中1 耳コピ】Yukopi / 歌愛ユキ『私の歯医者さん / My Dentist』/ ゆこぴ / Kaai yuki【ピアノカバー / piano cover】", "mori ☆高校生ピアニスト☆"),
            searchItem("bpYeHAe4Ano", "(9.0) 私の歯医者さん [MASTER 13] (譜面確認) [CHUNITHM チュウニズム]", "チュウニズム譜面保管所 Mate"),
            searchItem("hOWrKK45EyY", "【男性声】私の歯医者さん / ゆこぴ // 歌ってみた（伴奏原曲キー）カラオケ【歌愛ユキ】", "歌好きのmikeチャンネル"),
            searchItem("OZCJ1kMvu4Q", "私の歯医者さん[ゆこぴ]カンマニChannelカラオケ歌ってみた🎵", "カンマニChannel🐬(公式)(Kanmani Channel🐬)"),
            searchItem("jBm_Cqkh7Ek", "【譜面確認用】私の歯医者さん MASTER【チュウニズムNEW外部出力】", "めーがす（meigus）"),
            searchItem("YjYPMc1LtqY", "私の歯医者さん / Yukopi【歌ってみた】Covered by mizuna", "mizuna"),
            searchItem("_RmV8Rld1oc", "【Yukopi】Kaai Yuki - My Dentist「Eng Sub + On Vocal」", "Kiriya Evi"),
            searchItem("VsdGF0K1298", "【ゆこぴ】ボカロP別人気曲メドレー", "ぼかろめどれー"),
        )
        stubDurations(
            "FDPeqBUySik" to "PT2M7S", "5R3Ny4l2EJg" to "PT2M7S", "YqKfOkat870" to "PT29S",
            "_VWZ_8Jrr0E" to "PT2M5S", "fCT831UD1II" to "PT1M14S", "tqo03d5mlCs" to "PT15S",
            "EbHy29Z0Llk" to "PT2M7S", "bpYeHAe4Ano" to "PT2M13S", "hOWrKK45EyY" to "PT2M17S",
            "OZCJ1kMvu4Q" to "PT2M7S", "jBm_Cqkh7Ek" to "PT2M16S", "YjYPMc1LtqY" to "PT2M8S",
        )
        every { youtubeClient.getChannel(any()) } returns null

        assertThat(service.searchMvUrl("私の歯医者さん", "ゆこぴ", 128))
            .isEqualTo("https://www.youtube.com/watch?v=FDPeqBUySik")
    }

    @Test
    fun `a romanized channel name listed beside another alias is the artist's own channel`() {
        every { artistChannelCache.get(any()) } returns null
        stubSearch(
            searchItem("VWMCely7eXw", "【歌ってみた】jigoku/イルマ【聖ルナティア/ゆにれいど】#vtuber #shorts #cover", "聖ルナティア / Sei Lunathia"),
            searchItem("d2RoDqXXLcM", "【イルマ】feat.初音ミク「jigoku」をちょっとだけ弾いてみました。#Shorts", "yuka .kokoromoyou"),
            searchItem("uc36Tljl_X8", "jigoku / イルマ feat.初音ミク", "iai / IRUMA"),
            searchItem("Wd1xOzelTEI", "jigoku / イルマ　歌ってみた　yukino", "yukino"),
            searchItem("z6LDb0WN6As", "Iri / イルマ feat.初音ミク (Intro of jigoku)", "iai / IRUMA"),
            searchItem("czFbioVnFPk", "イルマ 2nd Single 『 jigoku 』【XFADE】", "iai / IRUMA"),
            searchItem("nx_xU7TkdvM", "jigoku / イルマ feat.初音ミク #ボカロ #オリジナル曲 #初音ミク", "iai / IRUMA"),
            searchItem("4juQJU5MVWs", "jigoku / iai", "iai / IRUMA"),
            searchItem("h0B2Yr9OztM", "jigoku edgerunner【AMV/ イルマ/ VOCALOID】", "ojosamasaigo"),
            searchItem("yXLMLp2Z5zw", "【Ari Anjou】jigoku - イルマ IRUMA【cover】", "Ari Anjou"),
            searchItem("li4LysxDEWE", "jigoku/イルマ【Covered by 紫雨。】", "紫雨。"),
            searchItem("caoXgFhNiLc", "jigoku / イルマ 歪", "ゲてぅた🎭"),
            searchItem("gZw4qb0ubeg", "jigoku / イルマ　歌ってみた yukino #歌ってみた #jigoku #イルマ　#歌い手", "yukino"),
            searchItem("OhBEjco4OL8", "#魔入りました入間くん#最強ランキング#shorts", "ぱーりゅあ"),
            searchItem("LP86xn5PczA", "イルマ 2nd Album『 urei 』【XFADE】", "iai / IRUMA"),
        )
        stubDurations(
            "uc36Tljl_X8" to "PT2M47S", "Wd1xOzelTEI" to "PT2M48S", "z6LDb0WN6As" to "PT1M25S",
            "czFbioVnFPk" to "PT1M50S", "nx_xU7TkdvM" to "PT33S", "4juQJU5MVWs" to "PT48S",
            "h0B2Yr9OztM" to "PT1M23S", "yXLMLp2Z5zw" to "PT2M50S", "li4LysxDEWE" to "PT2M49S",
            "caoXgFhNiLc" to "PT2M49S", "gZw4qb0ubeg" to "PT17S",
        )
        every { youtubeClient.getChannel(any()) } returns null

        assertThat(service.searchMvUrl("jigoku (feat. 初音ミク)", "イルマ", 167))
            .isEqualTo("https://www.youtube.com/watch?v=uc36Tljl_X8")
    }

    @Test
    fun `a channel segment carrying the romanized name plus other words is not the artist's own`() {
        stubVideo("fan-id", "jigoku / イルマ feat.初音ミク", channelTitle = "iai / IRUMA fanTR", duration = "PT2M47S")

        assertThat(service.acceptsAsOnlyCandidate("fan-id", "jigoku (feat. 初音ミク)", "イルマ", 167)).isFalse()
    }

    @Test
    fun `a kana artist's romanized channel upload wins over covers of a katakana title`() {
        every { artistChannelCache.get("ゆこぴ") } returns null
        stubSearch(
            searchItem("pm-a4AHppl4", "【144cmの先輩】チビマッチョのブタサンダーの替え歌が悲しいw【ぶたさんだー/ゆこぴ】#替え歌　#shorts", "ビコーン!BIKOON!"),
            searchItem("ZHnEewL_aPg", "ブタサンダーを歌わせて頂きました。 #歌い手 #歌ってみた #ボカロ #shorts #推し不在 #拡散希望  #Yukopi  #ブタサンダー  #ゆこぴ  #新人歌い手", "ユーリちゃんねる"),
            searchItem("AIDelHN20pg", "ブタサンダー-Yukopi#shorts", "maru"),
            searchItem("xruueaAMeaY", "yukopi - 🐖 ブタサンダー🐖 l Haachama Ver. #yukopi #vtuber #shorts", "HAACHAMA Ch 赤井はあと"),
            searchItem("scSvNQkeFJs", "これにしか聞こえない #shorts #強風オールバック #ゆこぴ #ブタサンダー", "ふる / 1000人目標"),
            searchItem("kCOCJC9gczA", "Yukopi - ブタサンダー (Arranged by ゆよゆっぺ )", "Yukopi"),
            searchItem("OOW4TjS71Mw", "ブタサンダー / てるとくん（3さい）【ゲーム実況者が歌ってみた】", "てるとくん"),
            searchItem("I8AuUZMl1n0", "【歌ってみた】ブタサンダー  feat.おおはらMEN", "さかいさんだー"),
            searchItem("pdPtAufvWFA", "ブタサンダー / 赤見かるび 【cover】", "赤見かるび / Karubi Akami"),
            searchItem("F2Ou5vlOIjM", "【ピアノ採譜】ブタサンダー - Yukopi", "ともち / tomochi - piano cover"),
            searchItem("wOvY1lhQgIU", "【リズム天国】ブタサンダー(feat.歌愛ユキ) / Yukopi", "よちこ"),
            searchItem("-_6nXG9i0tk", "ブタサンダー - Yukopi / Covered by けちゃ【歌ってみた】", "けちゃ【AMPTAK】"),
            searchItem("WOm1K3-R-IU", "(offvocal)ブタサンダー / Yukopi  feat.歌愛ユキ　リアルカラオケ(Instrumental)", "ミライカラオケ⛤"),
            searchItem("Kn8N-dgfWGc", "私いま、ぶたさんだ…【ブタサンダー】【マイクラアニメ】【マインクラフト】", "ラメリィ・フランソワ"),
            searchItem("Yl7C3eDLMx4", "Yukopi - たすけて！おふとんマン (feat.歌愛ユキ)", "Yukopi"),
        )
        stubDurations(
            "kCOCJC9gczA" to "PT2M37S", "OOW4TjS71Mw" to "PT2M17S", "I8AuUZMl1n0" to "PT2M19S",
            "pdPtAufvWFA" to "PT2M17S", "F2Ou5vlOIjM" to "PT2M20S", "wOvY1lhQgIU" to "PT2M24S",
            "-_6nXG9i0tk" to "PT2M17S", "WOm1K3-R-IU" to "PT2M17S", "Kn8N-dgfWGc" to "PT14S",
        )
        every { youtubeClient.getChannel(any()) } returns null

        assertThat(service.searchMvUrl("ブタサンダー", "ゆこぴ", 136))
            .isEqualTo("https://www.youtube.com/watch?v=kCOCJC9gczA")
    }

    @Test
    fun `search splits a catalog title whose separator directly follows an exclamation mark`() {
        val artist = "米津玄師"
        val channel = "Kenshi Yonezu  米津玄師"
        every { artistChannelCache.get(artist) } returns null
        val items = listOf(
            searchItem("-wb2PAx6aEs", "米津玄師 - さよーならまたいつか！ Kenshi Yonezu - Sayonara, Mata Itsuka !", channel),
            searchItem("I8Lqr6NeG5o", "米津玄師 - さよーならまたいつか！「第75回NHK紅白歌合戦」 Kenshi Yonezu - Sayonara, Mata Itsuka ! 75th NHKKouhaku Performance", channel),
            searchItem("5DNqESedFMk", "米津玄師 - さよーならまたいつか！「虎に翼」OPタイトルバック・フル　Kenshi Yonezu - Sayonara, Mata Itsuka !", channel),
            searchItem("70tC0VINZAY", "Kenshi Yonezu - Sayonara, Mata Itsuka ! / 米津玄師 - さよーならまたいつか！Lyrics Video (Kan/Rom/Eng)", "TATATAN"),
            searchItem("mIhe7xFItA8", "[Kor sub]米津玄師  さよーならまたいつか Kenshi Yonezu  (한글가사, 한글발음)Sayonara Mata Itsuka", "Double-baked_Pizza (두 번 구운 피자)"),
            searchItem("j81-t5rNlj8", "【カラオケ】さよーならまたいつか！/米津玄師 - 朝ドラ『虎に翼』主題歌", "カラオケ歌っちゃ王"),
            searchItem("ThSxM-piojY", "【歌ってみた】さよーならまたいつか！/星導ショウ", "星導ショウ / Hoshirube Sho【にじさんじ】"),
            searchItem("T39wT7BdHKA", "【ボイストレーナーが歌う】さよーならまたいつか！ / 米津玄師【シアーミュージック本厚木校 Ryoga】#shorts", "シアーミュージック"),
            searchItem("Zq72ILc1IzQ", "さよーならまたいつか！　cover （3DLIVE ver.）by葛葉", "Kuzuha Channel"),
            searchItem("sJPwrCkBr70", "【シティポップ】さよーならまたいつか！ / 米津玄師 – City Pop Night Drive ver.", "J-POP  World Tours"),
            searchItem("xBzJfBk79kM", "米津玄師 - さよーならまたいつか！「第75回NHK紅白歌合戦」#虎に翼　#さよーならまたいつか", channel),
            searchItem("7tFOcImiQOs", "隨心所欲做自己吧：さよーならまたいつか！- 米津玄師｜日劇《虎に翼》主題曲｜中日歌詞", "c1dworld"),
            searchItem("i5uYhP516Jk", "【楽譜あり】さよーならまたいつか！/米津玄師（ピアノソロ中級～上級） NHK連続テレビ小説『虎に翼』主題歌【ピアノアレンジ楽譜】", "Dさん【ピアノ楽譜】"),
            searchItem("ZmqDAwuzBAI", "さよーならまたいつか！/ 米津玄師（1989年） | Sayonara, Mata Itsuka - Kenshi Yonezu (80s Retro Style)", "裏・名曲選"),
            searchItem("xoEjl6E_Wmw", "米津玄師 - さよーならまたいつか！ 「第75回NHK紅白歌合戦」　#虎に翼　#さよーならまたいつか", channel),
        )
        stubSearch(*items.toTypedArray())
        stubDurations(*items.map { it.id.videoId!! to "PT3M21S" }.toTypedArray())
        every { youtubeClient.getChannel(any()) } returns null

        assertThat(service.searchMvUrl("さよーならまたいつか!- Sayonara", artist, 201))
            .isEqualTo("https://www.youtube.com/watch?v=-wb2PAx6aEs")
    }

    @Test
    fun `a hyphen inside a word does not split the catalog title`() {
        every { artistChannelCache.get(ARTIST) } returns null
        stubSearch(searchItem("other-id", "$ARTIST - Spider (Official MV)"))
        stubDurations("other-id" to "PT4M")

        assertThat(service.searchMvUrl("Spider-Man", ARTIST, TRACK_SECONDS)).isNull()
    }

    @Test
    fun `search matches a one-character title when the video title also names the artist`() {
        val artist = "米津玄師"
        val officialChannel = "Kenshi Yonezu  米津玄師"
        every { artistChannelCache.get(artist) } returns null
        stubSearch(
            searchItem("zOytsTU8v7U", "米津玄師 烏 歌詞 | Kenshi Yonezu Karasu 『Raven』 Lyrics (Rom/Kan/Eng)", "World of Japan "),
            searchItem("gG8-tlIi3p4", "米津玄師(요네즈 켄시) -  烏(까마귀 / Karasu - Raven) // 가사, 한글 발음, 번역", "새앤드"),
            searchItem("iz1YsGfbJbc", "[자막/해석] ⚽️ 米津玄師(요네즈켄시) - 烏(까마귀/ Raven) 2026 NHK 축구 테마송  Full ver. [애니 블루록]", "쌀미"),
            searchItem("T1RgUouto1Y", "米津玄師「烏」Kenshi Yonezu - Karasu (Raven)  Short Anime", officialChannel),
            searchItem("JHWg7yjg4nQ", "NHK FIFA World Cup 2026 Theme Song- Karasu(Raven) / 烏 by Kenshi Yonezu (FULL) Lyrics ENG/ROM/JPN", "ROKA's POP Digs"),
            searchItem("isZFxm7pPbI", "ピアニストが弾く 米津玄師 - 烏 【piano cover】Karasu/Raven", "電灯さん Pianist"),
            searchItem("5ARguGHJfao", "Kenshi Yonezu - Karasu (Raven)", "UtaLoid"),
            searchItem("YjPMupS1Lg4", "米津玄師 - 烏　Kenshi Yonezu -  Karasu", officialChannel),
            searchItem("6uVe1G5Zfu4", "|中字翻譯| 米津玄師 - 烏 Kenshi Yonezu - Karasu （Lyrics)", "Cenlinei"),
            searchItem("QbmOAY4-NXA", "烏 (米津玄師) ／ダズビー COVER", "DAZBEE official"),
            searchItem("gDFQshW1NHc", "日本代表 2026北中米ワールドカップ ハイライト「烏/米津玄師」【MV】", "WFB"),
            searchItem("GDoZ8Q1CGfk", "米津玄師『烏』フル【歌詞付き】", "まー ミセスと地理好き"),
            searchItem("7lcKYgxEa8E", "米津玄師「烏」Kenshi Yonezu - Karasu  #サッカー #W杯", officialChannel),
            searchItem("4I9SHg-bW4g", "米津玄師「 烏 」【2026サッカーワールドカップテーマソング】歌詞付き！", "あて"),
            searchItem("E4xISPijVJk", "【作業用・耐久】烏 - 米津玄師 -　2026 NHKサッカーテーマ　Extended 1 Hour", "ろっどまん"),
        )
        stubDurations(
            "zOytsTU8v7U" to "PT4M7S", "gG8-tlIi3p4" to "PT4M8S", "iz1YsGfbJbc" to "PT4M9S",
            "T1RgUouto1Y" to "PT40S", "JHWg7yjg4nQ" to "PT4M9S", "isZFxm7pPbI" to "PT4M11S",
            "5ARguGHJfao" to "PT48S", "YjPMupS1Lg4" to "PT4M8S", "6uVe1G5Zfu4" to "PT4M8S",
            "QbmOAY4-NXA" to "PT4M10S", "gDFQshW1NHc" to "PT4M8S", "GDoZ8Q1CGfk" to "PT4M8S",
            "7lcKYgxEa8E" to "PT4M8S", "4I9SHg-bW4g" to "PT4M8S", "E4xISPijVJk" to "PT1H",
        )
        every { youtubeClient.getChannel(any()) } returns null

        assertThat(service.searchMvUrl("烏 - Raven", artist, 248))
            .isEqualTo("https://www.youtube.com/watch?v=YjPMupS1Lg4")
    }

    @Test
    fun `a one-character title inside another word does not match`() {
        every { artistChannelCache.get(ARTIST) } returns null
        stubSearch(searchItem("other-song-id", "$ARTIST 烏賊 Official MV"))
        stubDurations("other-song-id" to "PT4M8S")

        val result = service.search("烏 - Raven", ARTIST, 248)

        assertThat(result.url).isNull()
        assertThat(result.candidates.single().rejection).isEqualTo("title-mismatch")
    }

    @Test
    fun `search accepts a character's MV on the project channel that names the character in the title`() {
        val artist = "MILGRAM シドウ (CV: 仲村宗悟)"
        every { artistChannelCache.get(artist) } returns null
        stubSearch(
            searchItem("YR4sGpMqQJQ", "MILGRAM -ミルグラム- / シドウ「スローダウン」第一審MV", "MILGRAM -ミルグラム-"),
            searchItem("snV3847fBj4", "【D4DJ/グルミク】スローダウン / MILGRAM シドウ (CV: 仲村宗悟) [PFC(MAX-3)]", "からむちょ"),
            searchItem("YCFhkXR6h9A", "【中日歌詞翻譯】MILGRAM -ミルグラム- / 桐崎獅童(シドウ)「スローダウン/Throw down」第一審MV（後附Shidou角色介紹）(Full/Lyrics/中文字幕)", "yuka。中日翻譯"),
            searchItem("EzQAKC8L1-w", "【歌ってみた】MILGRAM - ミルグラム - / シドウ「スローダウン」第一審MV", "Mikado Kujo"),
            searchItem("T5AJfkJ8EwQ", "【D4DJ グルミク】スローダウン (EX12/PFC/手元) MILGRAM シドウ(CV: 仲村宗悟)/ DECO*27【高音質 Groovy Mix】", "とてちゃむ.Tote-cham."),
            searchItem("3Lenmxh5uFE", "【MILGRAM ミルグラム】シドウ(左) x エス(右)「スローダウン」中日歌詞", "咩醬"),
            searchItem("WYBBgKQQEN8", "【歌ってみた】スローダウン／MILGRAM シドウ(CV.仲村宗悟)", "りーな"),
            searchItem("ETjhKDpG_sk", "【MILGRAM】005シドウ一審歌曲『スローダウン』歌詞&amp;MV解析｜紫夜星羽", "紫夜星羽"),
            searchItem("X30VYjI1g5s", "MILGRAM ミルグラム /Throw Down シドウ「スローダウン」-【.jpeg】cover", "jpeg_gg"),
            searchItem("KA8xH1QELeI", "MILGRAM -ミルグラム- / 「スローダウン -エス Cover-」", "MILGRAM -ミルグラム-"),
            searchItem("BKjpPePYn4Y", "MILGRAM -ミルグラム- / シドウ「トリアージ」第二審MV", "MILGRAM -ミルグラム-"),
            searchItem("KiqJfym6YEo", "Throw Down (Off Voice)", "MILGRAM Shidou (CV: Shugo Nakamura) - Topic"),
            searchItem("et3CPTd2Qb4", "MILGRAM -ミルグラム- / 囚人番号005番『桐崎 獅童』第三審", "MILGRAM -ミルグラム-"),
            searchItem("Dj3J36IgJl8", "MILGRAM -ミルグラム- / 第二審 5th EP シドウ (CV: 仲村宗悟)「トリアージ」Trailer", "MILGRAM -ミルグラム-"),
            searchItem("Cg6j59ADn2g", "Liar Dance (SHIDOU Cover)", "MILGRAM Shidou (CV: Shugo Nakamura) - Topic"),
        )
        stubDurations(
            "YR4sGpMqQJQ" to "PT3M48S", "snV3847fBj4" to "PT2M31S", "YCFhkXR6h9A" to "PT3M58S",
            "EzQAKC8L1-w" to "PT3M48S", "T5AJfkJ8EwQ" to "PT2M42S", "3Lenmxh5uFE" to "PT3M48S",
            "WYBBgKQQEN8" to "PT3M45S", "ETjhKDpG_sk" to "PT18M33S", "X30VYjI1g5s" to "PT3M53S",
            "KA8xH1QELeI" to "PT3M48S",
        )
        every { youtubeClient.getChannel(any()) } returns null

        assertThat(service.searchMvUrl("スローダウン", artist, 229))
            .isEqualTo("https://www.youtube.com/watch?v=YR4sGpMqQJQ")
    }

    @Test
    fun `a project channel upload of the song by another character is not the artist's`() {
        val artist = "MILGRAM シドウ (CV: 仲村宗悟)"
        every { artistChannelCache.get(artist) } returns null
        stubSearch(searchItem("KA8xH1QELeI", "MILGRAM -ミルグラム- / エス「スローダウン」第一審MV", "MILGRAM -ミルグラム-"))
        stubDurations("KA8xH1QELeI" to "PT3M48S")

        assertThat(service.searchMvUrl("スローダウン", artist, 229)).isNull()
    }

    @Test
    fun `a fan channel carrying the project name is not the project channel`() {
        val artist = "MILGRAM シドウ (CV: 仲村宗悟)"
        every { artistChannelCache.get(artist) } returns null
        stubSearch(searchItem("fanSub0001", "シドウ「スローダウン」第一審MV", "MILGRAM 歌詞 English Sub"))
        stubDurations("fanSub0001" to "PT3M49S")

        assertThat(service.searchMvUrl("スローダウン", artist, 229)).isNull()
    }

    @Test
    fun `a Hangul suffix on the artist's own channel is not penalized`() {
        every { artistChannelCache.get("PLAVE") } returns null
        stubSearch(
            searchItem("pOmJ65UnPEY", "PLAVE &#39;Flame (feat. milet)&#39; M/V", "PLAVE 플레이브"),
            searchItem("oYSgcuif8pI", "PLAVE &#39;Flame (feat. milet)&#39; Lyrics (플레이브 Flame 가사) [Color Coded Kan_Rom_Eng]", "Chenyeol"),
            searchItem("OiFqCyW3KyI", "PLAVE (플레이브) - Flame (feat. milet) | Color Coded Lyrics (Kan/Rom/Eng)", "Soba-chan"),
            searchItem("lcCUH5vr9Ps", "[플레이브] 260927 Flame (feat. milet) | PLAVE World Tour [KEEP IT MANIC] in Japan", "뮈.."),
            searchItem("retiYLphYXw", "Flame ⚽️🏃🏃🏃‍♀️🏃💨 #PLAVE #プレイブ #YEJUN #NOAH #HAMIN #Flame #milet @miletOfficialYouTubeChannel", "PLAVE 플레이브"),
            searchItem("6BKWNyK7RbU", "260926 PLAVE KEEP IT MANIC IN JAPAN FLAME 신곡 무대 #플레이브 #plave", "김폴링"),
            searchItem("3-fzl8V8l2g", "PLAVE - Flame [Flame (feat. milet)]ㅣ가사/Lyrics", "베어뮤직 BearMusic"),
            searchItem("fQx32Q6HTn8", "PLAVE &#39;Flame (feat. milet)&#39; M/V Teaser", "PLAVE 플레이브"),
            searchItem("2WnL2ARuj5I", "Musician Reacts to PLAVE (플레이브) - &#39;Flame (feat. milet)&#39; M/V | First Time Reaction!", "Velo City"),
            searchItem("oXPB_Pa58aU", "PLAVE &#39;Flame (feat. milet)&#39; M/V REACTION", "Alexa Takes A Look"),
            searchItem("leVEgwDQijA", "PLAVE &#39;Flame (feat. milet)&#39; M/V Teaser #PLAVE #プレイブ #milet @miletOfficialYouTubeChannel", "PLAVE 플레이브"),
            searchItem("VPC4Rd49O6M", "REACTING TO PLAVE&#39;S NEW MUSIC VIDEO FLAME", "Phoenixx Reacts"),
            searchItem("DwYIjCC7IlM", "PLAVE (플레이브) - Flame (feat. milet) | 260927 KEEP IT MANIC in JAPAN", "왕옹"),
            searchItem("IvuMf8vQA40", "PLAVE x milet ‘FLAME’ MV REACTION | THEIR VOICES TOGETHER?!", "Fangirlz Reacts"),
            searchItem("-3yStw4kjR4", "26/09/26 플레이브 일본콘서트-Flame(feat.milet)", "할리밤"),
        )
        stubDurations(
            "pOmJ65UnPEY" to "PT3M13S", "oYSgcuif8pI" to "PT3M11S", "OiFqCyW3KyI" to "PT3M8S",
            "lcCUH5vr9Ps" to "PT3M9S", "retiYLphYXw" to "PT27S", "6BKWNyK7RbU" to "PT3M9S",
            "3-fzl8V8l2g" to "PT3M8S", "fQx32Q6HTn8" to "PT30S", "2WnL2ARuj5I" to "PT5M24S",
            "oXPB_Pa58aU" to "PT7M32S", "leVEgwDQijA" to "PT30S", "VPC4Rd49O6M" to "PT6M22S",
            "DwYIjCC7IlM" to "PT3M9S", "IvuMf8vQA40" to "PT22M15S", "-3yStw4kjR4" to "PT3M10S",
        )
        every { youtubeClient.getChannel(any()) } returns null

        assertThat(service.searchMvUrl("Flame (feat. milet)", "PLAVE", 187))
            .isEqualTo("https://www.youtube.com/watch?v=pOmJ65UnPEY")
    }

    @Test
    fun `a Hangul channel that is not the artist's still loses its reupload`() {
        every { artistChannelCache.get("PLAVE") } returns null
        stubSearch(searchItem("reupload-id", "PLAVE &#39;Flame (feat. milet)&#39; M/V", "플레이브 팬"))
        stubDurations("reupload-id" to "PT3M13S")

        assertThat(service.searchMvUrl("Flame (feat. milet)", "PLAVE", 187)).isNull()
    }

    @Test
    fun `a catalog title with a trailing feat credit still matches the MV`() {
        every { artistChannelCache.get("Neru") } returns null
        stubSearch(
            searchItem("eSI7RsjZy1E", "Neru - 東京テディベア(Tokyo Teddy Bear) feat. Kagamine Rin", "Neru OFFICIAL"),
            searchItem("6CvZxF_IP9E", "Hatsune Miku: Project DIVA Future Tone - [PV] &quot;Tokyo Teddy Bear&quot; (Romaji/English/Español S", "Karin's Channel"),
            searchItem("UqulFtYBdGw", "東京テディベア / Leo/need × 鏡音リン", PUBLISHER_CHANNEL),
            searchItem("xzr7zdnKPgc", "[FULL VER] 東京テディベア (Tokyo Teddy Bear) / Leo/need × 鏡音リン / プロセカ 歌詞 CC LYRICS", "Yan☆"),
            searchItem("gdzlV-1_ghM", "Neru - 도쿄 테디베어(東京テディベア) feat. 카가미네 린 [한글자막/가사]", "Lighthappy-r2w"),
            searchItem("E8BqQAzLl7o", "Kagamine Rin 【鏡音リン】- Tokyo Teddy Bear 【東京テディベア】Magical Mirai 2013 LIVE", "aws鑑賞"),
            searchItem("lLDpISmaDvA", "東京テディベア - 2026 Arrange ver. - ／まふまふ【歌ってみた】", "まふまふちゃんねる"),
            searchItem("tXa2rc2ytJ0", "東京テディベア / Neru -Cover- ウォルピスカーター", "ウォルピス社"),
            searchItem("8xGFOCdsTV8", "60fps Tokyo Teddy Bear 東京テディベア   Kagamine Rin 鏡音リン DIVA English lyrics Romaji subtitles PDA FT", "Василий Зубко"),
            searchItem("wXDKF1zFAE4", "【Neru feat. Kagamine Rin】Tokyo Teddy Bear【Sub. Español + Romaji】", "LoreHappy"),
            searchItem("bchHRTY18Xg", "#東京テディベア (Tokyo Teddy Bear) feat. Kagamine Rin #Neru #VOCALOID", "Neru OFFICIAL"),
            searchItem("7PC6wVbbbmM", "東京テディベア/Neru 重音テトcover #synthesizerv #重音テト #vocaloid", "イトナンジ / itonanji"),
            searchItem("HihnMaEuofM", "【METAL COVER】 &quot;TOKYO TEDDY BEAR&quot; (but its rly emo) // 東京テディベア by @NeruOFFICIAL [ENG]", "yukigloom"),
            searchItem("wLv_lSvQD6M", "Karaoke♬ Tokyo Teddy Bear feat. Kagamine Rin - Neru 【No Guide Melody】 Instrumental, Lyric Romanized", "EdKara"),
            searchItem("znMI4CXP7ms", "東京テディベア / Neru feat.鏡音リン 全良【太鼓の達人】", "team RNH【太鼓の達人】"),
        )
        stubDurations(
            "eSI7RsjZy1E" to "PT3M14S", "UqulFtYBdGw" to "PT3M14S", "xzr7zdnKPgc" to "PT3M14S",
            "gdzlV-1_ghM" to "PT3M14S", "E8BqQAzLl7o" to "PT3M14S", "lLDpISmaDvA" to "PT3M14S",
            "tXa2rc2ytJ0" to "PT3M14S", "8xGFOCdsTV8" to "PT3M14S", "bchHRTY18Xg" to "PT3M14S",
            "7PC6wVbbbmM" to "PT3M14S", "HihnMaEuofM" to "PT3M14S", "znMI4CXP7ms" to "PT3M14S",
        )
        every { youtubeClient.getChannel(any()) } returns null

        assertThat(service.searchMvUrl("東京テディベア feat.鏡音リン", "Neru", 194))
            .isEqualTo("https://www.youtube.com/watch?v=eSI7RsjZy1E")
    }

    @Test
    fun `search takes an official MV whose title carries the song's version tag under an abbreviated artist name`() {
        val artist = "TOMORROW X TOGETHER"
        every { artistChannelCache.get(artist) } returns null
        stubSearch(
            searchItem("d5bbqKYu51w", "TXT (투모로우바이투게더) &#39;0X1=LOVESONG (I Know I Love You) feat. Seori&#39; Official MV", "HYBE LABELS"),
            searchItem("vPULo1B730o", "TXT - 0X1=LOVESONG (I Know I Love You) feat. Seori Lyrics (Color Coded Lyrics)", "Jaeguchi"),
            searchItem("swZ-GR0maMs", "[최초공개] TXT - 0X1=LOVESONG (I Know I Love You) feat. Seori | TXT COMEBACKSHOW | Mnet 210531 방송", "M2"),
            searchItem("OylSv6vVDeI", "TXT (투모로우바이투게더) - ‘0X1=LOVESONG (I Know I Love You) feat. Seori&#39; @ Good Morning America", "TOMORROW X TOGETHER OFFICIAL"),
            searchItem("95brCYLNoEo", "[KCON LA 2026] TOMORROW X TOGETHER - 0X1=LOVESONG (I Know I Love You) feat. Seori | Mnet 260906 방송", "KCON official"),
            searchItem("TiuPfYJeDkQ", "TOMORROW X TOGETHER - 0X1=LOVESONG(I Know I Love You)(Band Ver.)) (Sketchbook) | KBS WORLD TV 210618", "KBS WORLD TV"),
            searchItem("dEPvbNz9koM", "Tomorrow X Together - 0X1=LOVESONG (I Know I Love You) (Music Bank) | KBS WORLD TV 210611", "KBS WORLD TV"),
            searchItem("AXcwwO_YeKo", "TXT (투모로우바이투게더) &#39;0X1=LOVESONG (I Know I Love You) feat. Seori&#39; Dance Practice", "TOMORROW X TOGETHER OFFICIAL"),
            searchItem("4Ikf3r_LfbQ", "TXT- 0X1LOVESONG(I know I love you)Feat. Seori (Audio)", "ANULAGEU(아누라그)"),
            searchItem("0M4XP3DeP3Q", "TOMORROW X TOGETHER - 0X1=LOVESONG(I Know I Love You) (Music Bank Special) | KBS WORLD TV 210625", "KBS WORLD TV"),
            searchItem("ot5ynAV7MMA", "0X1=LOVESONG (I Know I Love You) 피처링. Seori (Emocore Mix)", "TOMORROW X TOGETHER - Topic"),
            searchItem("8o0w6tGLoq8", "TXT 0X1=LOVESONG (I Know I Love You) feat. Seori Lyrics [Color Coded Lyrics/Han/Rom/Eng]", "Lemoring"),
            searchItem("s8lMfE7kjes", "[TOMORROW X TOGETHER - 0X1=LOVESONG (I Know I Love You) feat.Seori] Comeback Stage |  Mnet 210603 방송", "Mnet K-POP"),
            searchItem("wwElgBu3VNE", "TXT - 0X1=LOVESONG (I Know I Love You) feat. Seori (Line Distribution + Lyrics) PATREON REQUESTED", "random_k"),
            searchItem("EieUsaKgbsU", "TXT (투모로우바이투게더) &#39;0X1=LOVESONG (I Know I Love You) feat. Ikuta Lilas [Japanese Ver.]&#39; Official MV", "HYBE LABELS"),
        )
        stubDurations("EieUsaKgbsU" to "PT4M14S")
        every { youtubeClient.getChannel(any()) } returns null

        val result = service.search("0X1=LOVESONG (I Know I Love You) [feat. 幾田りら] [Japanese Ver.]", artist, 205)

        assertThat(result.url).isEqualTo("https://www.youtube.com/watch?v=EieUsaKgbsU")
        assertThat(result.candidates.single { it.videoId == "d5bbqKYu51w" }.rejection).isEqualTo("version-mismatch")
    }

    @Test
    fun `a kana-only title matches its romanized upload titles`() {
        val artist = "藤井 風"
        val title = "まつり (Fujii Kaze Stadium Live \"Feelin' Good\")"
        every { artistChannelCache.get(artist) } returns null
        stubSearch(
            searchItem("fpl8ubntjl4", "藤井風「まつり」Fujii Kaze, Fuji rock 2026", "ミッキーチャンネル💨🍃"),
            searchItem("2whxqI3hFbQ", "후지이 카제 - 마츠리 교차편집 | Matsuri まつり live stage mix | 한글 자막", "엔딩"),
            searchItem("NXAtnDGDTiM", "Fujii Kaze - Matsuri (まつり) (Lyrics) (Vietsub)", "Other Guy"),
            searchItem("QRSZU7d0EZs", "060224 Fujii Kaze 藤井風 - Matsuri まつり @ The Apollo Theatre", "VERAYA"),
            searchItem("8-k9hc7npoo", "まつり (Matsuri) - 藤井風(Fujii kaze)[LOVE ALL SERVE ALL]［中文翻譯 | 中日歌詞 | lyrics video] &quot;人生所有事情都是宇宙給予我們", "Magic Fox"),
            searchItem("O3X159c9WIg", "‘Fujii Kaze (藤井 風) - Matsuri (まつり) Official Video’ reaction mashup", "minä rakastan sinua"),
            searchItem("NwOvu-j_WjY", "Fujii Kaze -  Matsuri (Official Video)", "Fujii Kaze"),
            searchItem("fDg3PTQ1tzM", "Fujii Kaze - &quot;Matsuri&quot; Live at Panasonic Stadium Suita", "Fujii Kaze"),
            searchItem("ECA-nGD50bY", "후지이카제 - &quot;Matsuri&quot; 축제 (Nissan Stadium Live &quot;Feelin&#39; Good&quot; 2024) 라이브 Live 한글자막", "뿌지카제"),
            searchItem("pHyVeHHLYIo", "Kaze dances to &quot;Matsuri&quot; no matter what", "Fujii Kaze"),
            searchItem("lpWs-Tn3G94", "Fujii Kaze - Matsuri【Lyrics/Romaji/Terjemahan】", "Astadala"),
            searchItem("odQwmaBrQfc", "Matsuri (Fujii Kaze Stadium Live &quot;Feelin&#39; Good&quot;)", "Fujii Kaze - Topic"),
            searchItem("rGyQHyDMZZI", "Fujii Kaze: Tiny Desk Concerts JAPAN", "NPR Music"),
            searchItem("l1WXOtTv0HY", "[J-POP] 축제(祭り) - 후지이 카제(Fujii Kaze) 가사/해석", "yooni.verse_윤이버스"),
            searchItem("wsPE5jzoGxI", "Fujii Kaze - &quot;Matsuri&quot; Behind The Scenes", "Fujii Kaze"),
        )
        stubDurations(
            "fpl8ubntjl4" to "PT3M58S", "2whxqI3hFbQ" to "PT4M33S", "NXAtnDGDTiM" to "PT3M53S",
            "QRSZU7d0EZs" to "PT6M39S", "8-k9hc7npoo" to "PT3M49S", "O3X159c9WIg" to "PT4M18S",
            "NwOvu-j_WjY" to "PT4M41S", "odQwmaBrQfc" to "PT11M14S",
            // Assumed: the production trace never looked these up, since they failed the title check then.
            "pHyVeHHLYIo" to "PT58S", "wsPE5jzoGxI" to "PT4M30S",
        )
        every { youtubeClient.getChannel(any()) } returns null

        assertThat(service.searchMvUrl(title, artist, 674))
            .isEqualTo("https://www.youtube.com/watch?v=odQwmaBrQfc")
    }

    @Test
    fun `a romanized kana title must stand as a whole word`() {
        every { artistChannelCache.get(ARTIST) } returns null
        stubSearch(searchItem("other-id", "$ARTIST - Hanabi (Official Video)"))
        stubDurations("other-id" to "PT4M")

        assertThat(service.searchMvUrl("はな", ARTIST, TRACK_SECONDS)).isNull()
    }

    @Test
    fun `a game-size cut on a publisher channel is not the MV`() {
        every { artistChannelCache.get("Trickstar") } returns null
        stubSearch(
            searchItem("game-id", "Trickstar「Rebellion Star」 あんさんぶるスターズ！！ Music ゲームサイズMV", "あんスタチャンネル"),
        )
        stubDurations("game-id" to "PT2M10S")

        assertThat(service.searchMvUrl("Rebellion Star", "Trickstar", 240)).isNull()
    }

    @Test
    fun `a miss reports every candidate and why it was dropped`() {
        every { artistChannelCache.get(ARTIST) } returns null
        stubSearch(
            searchItem("other-id", "別の曲 Official MV"),
            searchItem("short-id", "$TITLE Official MV"),
            searchItem("cover-id", "$TITLE 歌ってみた", "歌い手"),
        )
        stubDurations("short-id" to "PT30S", "cover-id" to "PT4M")

        val result = service.search(TITLE, ARTIST, TRACK_SECONDS)

        assertThat(result.url).isNull()
        assertThat(result.candidates.map { it.videoId to it.rejection }).containsExactlyInAnyOrder(
            "other-id" to "title-mismatch",
            "short-id" to "Shorts-length",
            "cover-id" to null,
        )
        assertThat(result.candidates.single { it.videoId == "cover-id" }.score).isNegative()
    }

    private fun stubSearch(vararg items: YoutubeSearchItemDto) {
        every {
            youtubeClient.searchVideos(query = any(), pageToken = any(), maxResults = any(), videoCategoryId = any(), order = any())
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

    private fun stubVideo(
        videoId: String,
        title: String,
        channelTitle: String,
        duration: String,
        contentRating: YoutubeContentRatingDto? = null,
    ) {
        every { youtubeClient.getVideo(videoId) } returns YoutubeVideoItemDto(
            id = videoId,
            contentDetails = YoutubeContentDetailsDto(duration = duration, contentRating = contentRating),
            snippet = searchItem(videoId, title, channelTitle).snippet,
        )
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
        private const val LIELLA_CHANNEL_ID = "UCGzO-WBL6ggp2TIoW0fhPjA"
        private const val TRACK_SECONDS = 240
        private const val NIIGO = "25時、ナイトコードで。"
        private const val NIIGO_TITLE = "熱異常 (feat. 宵崎奏, 朝比奈まふゆ, 東雲絵名, 暁山瑞希 & KAITO)"
        private const val PUBLISHER_CHANNEL = "プロジェクトセカイ カラフルステージ! feat. 初音ミク"
    }
}
