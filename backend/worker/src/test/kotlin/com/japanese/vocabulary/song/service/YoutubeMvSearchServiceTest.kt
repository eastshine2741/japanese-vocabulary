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
    fun `search accepts a reupload on a stranger's channel when nothing official is found`() {
        every { artistChannelCache.get(ARTIST) } returns null
        stubSearch(searchItem("reupload-id", "$ARTIST - $TITLE", "音楽音楽"))
        stubDurations("reupload-id" to "PT3M58S")

        assertThat(service.searchMvUrl(TITLE, ARTIST, TRACK_SECONDS))
            .isEqualTo("https://www.youtube.com/watch?v=reupload-id")
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

        assertThat(service.searchMvUrl("私の歯医者さん", "ゆこぴ", 128))
            .isEqualTo("https://www.youtube.com/watch?v=FDPeqBUySik")
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

        assertThat(service.searchMvUrl("ブタサンダー", "ゆこぴ", 136))
            .isEqualTo("https://www.youtube.com/watch?v=kCOCJC9gczA")
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
