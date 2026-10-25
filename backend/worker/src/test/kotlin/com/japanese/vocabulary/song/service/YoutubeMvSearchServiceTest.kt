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
        private const val TRACK_SECONDS = 240
        private const val NIIGO = "25時、ナイトコードで。"
        private const val NIIGO_TITLE = "熱異常 (feat. 宵崎奏, 朝比奈まふゆ, 東雲絵名, 暁山瑞希 & KAITO)"
        private const val PUBLISHER_CHANNEL = "プロジェクトセカイ カラフルステージ! feat. 初音ミク"
    }
}
