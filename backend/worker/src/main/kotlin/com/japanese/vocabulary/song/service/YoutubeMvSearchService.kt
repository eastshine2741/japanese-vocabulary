package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.common.text.ArtistCredit
import com.japanese.vocabulary.song.cache.ArtistChannelCache
import com.japanese.vocabulary.song.cache.ArtistChannelCacheEntry
import com.japanese.vocabulary.mvsearch.client.youtube.YoutubeClient
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubeSearchItemDto
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.text.Normalizer
import java.time.Duration

@Service
class YoutubeMvSearchService(
    private val youtubeClient: YoutubeClient,
    private val artistChannelCache: ArtistChannelCache,
) {
    private val logger = LoggerFactory.getLogger(YoutubeMvSearchService::class.java)

    fun searchMvUrl(title: String, artist: String, trackDurationSeconds: Int?): String? =
        search(title, artist, trackDurationSeconds).url

    /** [MvSearchResult.candidates] holds what every path saw, so a miss can be judged without re-querying YouTube. */
    fun search(title: String, artist: String, trackDurationSeconds: Int?): MvSearchResult {
        val durationBounds = DurationBounds.forTrack(trackDurationSeconds)
        val trace = mutableListOf<MvSearchCandidate>()

        val cachedCandidates = artistChannelCache.get(artist)
            ?.let { searchCachedUploads(title, artist, it, durationBounds, trace) }
            .orEmpty()
        pickMv(cachedCandidates)?.let { return MvSearchResult(youtubeUrl(it.videoId), trace) }

        val fallbackCandidates = searchFallback(title, artist, durationBounds, trace)
        pickMv(fallbackCandidates)?.let {
            maybeCacheArtistChannel(artist, it)
            return MvSearchResult(youtubeUrl(it.videoId), trace)
        }

        // Leftovers of both paths are ranked together so a cached-channel live clip cannot pre-empt a broad-search MV.
        val leftovers = cachedCandidates + fallbackCandidates
        val runnerUp = pickOfficialLyricVideo(leftovers)
            ?: pickArtistLive(leftovers)
            ?: pickUnofficialUpload(leftovers)
            ?: return MvSearchResult(null, trace)
        maybeCacheArtistChannel(artist, runnerUp)
        return MvSearchResult(youtubeUrl(runnerUp.videoId), trace)
    }

    private fun searchCachedUploads(
        title: String,
        artist: String,
        cached: ArtistChannelCacheEntry,
        durationBounds: DurationBounds,
        trace: MutableList<MvSearchCandidate>,
    ): List<MvCandidate> {
        var pageToken: String? = null
        val matches = mutableListOf<MvCandidate>()
        var pagesRead = 0
        while (pagesRead < MAX_PLAYLIST_PAGES) {
            val response = youtubeClient.listPlaylistItems(
                playlistId = cached.uploadsPlaylistId,
                pageToken = pageToken,
                maxResults = PLAYLIST_PAGE_SIZE
            ) ?: return emptyList()
            pagesRead += 1

            // Uploads mix Shorts and live clips with MVs; duration is filtered once after all pages.
            // Uploads of other songs are not traced: a channel holds hundreds of them.
            response.items
                .filter { titleMatches(it.snippet.title, title) }
                .forEach { item ->
                    val videoId = item.snippet.resourceId.videoId ?: return@forEach
                    if (isShortsTitle(item.snippet.title)) {
                        trace += MvSearchCandidate.rejected(SOURCE_UPLOADS, videoId, item.snippet.title, item.snippet.channelTitle, REJECT_SHORTS_TAG)
                    } else {
                        matches += mvCandidate(SOURCE_UPLOADS, videoId, item.snippet.title, null, item.snippet.channelTitle, title, artist)
                    }
                }

            pageToken = response.nextPageToken ?: break
        }
        return filterByDuration(matches, durationBounds, trace)
    }

    private fun searchFallback(
        title: String,
        artist: String,
        durationBounds: DurationBounds,
        trace: MutableList<MvSearchCandidate>,
    ): List<MvCandidate> {
        // No videoCategoryId filter: publisher uploads such as Project SEKAI MVs are categorized as Gaming.
        val query = "${title.replace(TRAILING_DESCRIPTOR_RE, "").trim().ifBlank { title }} $artist"
        var source = SOURCE_SEARCH
        var items = searchItems(query, order = null)
        if (items.isEmpty()) {
            // YouTube's relevance ranking returns nothing for some word pairs ("少女A 椎名もた"); view-count ranking does not.
            source = SOURCE_SEARCH_BY_VIEWS
            items = searchItems(query, order = ORDER_VIEW_COUNT)
        }

        val candidates = items.mapNotNull { item ->
            val videoId = item.id.videoId ?: return@mapNotNull null
            val rejection = when {
                !titleMatches(item.snippet.title, title) -> REJECT_TITLE_MISMATCH
                isShortsTitle(item.snippet.title) -> REJECT_SHORTS_TAG
                else -> null
            }
            if (rejection != null) {
                trace += MvSearchCandidate.rejected(source, videoId, item.snippet.title, item.snippet.channelTitle, rejection)
                return@mapNotNull null
            }
            mvCandidate(source, videoId, item.snippet.title, item.snippet.channelId, item.snippet.channelTitle, title, artist)
        }
        return filterByDuration(candidates, durationBounds, trace)
    }

    private fun searchItems(query: String, order: String?): List<YoutubeSearchItemDto> =
        youtubeClient.searchVideos(
            query = query,
            maxResults = FALLBACK_MAX_RESULTS,
            videoCategoryId = null,
            order = order,
        )?.items.orEmpty()

    /**
     * The MV of this song by this artist; a candidate must be attributable to the artist so a
     * same-titled song by another artist cannot win (see [MvCandidate.artistVerified]).
     *
     * A Topic channel (auto-generated studio-track upload) is exempt from the artist check, since its
     * romanized channel name rarely matches, and stands in when no MV candidate survives. It still
     * must not be an off-vocal or instrumental track.
     */
    private fun pickMv(candidates: List<MvCandidate>): MvCandidate? =
        candidates.bestEligible { it.officialSource && !it.isLive }
            ?: candidates.firstOrNull { isTopicChannel(it.channelTitle) && !it.badTitle }

    /** The artist's own lyric video plays the studio track, so the synced lyrics still line up. */
    private fun pickOfficialLyricVideo(candidates: List<MvCandidate>): MvCandidate? =
        candidates.firstOrNull { it.isOfficialLyricVideo }

    /**
     * Fallback to the artist's own live when no MV exists. Ranks below the MV and the Topic
     * upload because a live take does not follow the studio timings of the synced lyrics.
     */
    private fun pickArtistLive(candidates: List<MvCandidate>): MvCandidate? =
        candidates.bestEligible { it.officialSource && it.isLive }

    /** A reupload on someone else's channel: the song, but neither official nor permanent. */
    private fun pickUnofficialUpload(candidates: List<MvCandidate>): MvCandidate? =
        candidates.bestEligible { !it.officialSource && !it.isLive }

    private fun List<MvCandidate>.bestEligible(tier: (MvCandidate) -> Boolean): MvCandidate? = this
        .filter { it.artistVerified && !isTopicChannel(it.channelTitle) }
        // Only the live penalty is forgiven; a live cover or karaoke clip stays rejected.
        .filter { it.scoreWithoutLivePenalty >= MIN_ACCEPTABLE_SCORE }
        .filter(tier)
        .maxByOrNull { it.score }

    /**
     * The Data API has no Short/live flag, so length against the catalog track length is the
     * proxy; see [DurationBounds.forTrack].
     *
     * Videos with a missing or unparsable duration are kept so a flaky lookup does not drop a
     * legitimate MV. `P0D` (live/premiere) has no length and is dropped.
     */
    private fun filterByDuration(
        candidates: List<MvCandidate>,
        bounds: DurationBounds,
        trace: MutableList<MvSearchCandidate>,
    ): List<MvCandidate> {
        if (candidates.isEmpty()) return candidates

        val durationsByVideoId = runCatching {
            youtubeClient.listVideoContentDetails(candidates.map { it.videoId })
                .associate { it.id to parseDurationSeconds(it.contentDetails.duration) }
        }.getOrElse { e ->
            logger.warn("YouTube duration lookup failed, keeping all candidates: {}", e.message)
            emptyMap()
        }

        return candidates.mapNotNull { candidate ->
            val seconds = durationsByVideoId[candidate.videoId]
            val rejection = seconds?.let { bounds.rejectionReason(it) }
            trace += candidate.trace(seconds, rejection)
            if (rejection == null) return@mapNotNull candidate
            logger.info(
                "Skipping {} YouTube candidate '{}' ({}s, bounds={}, videoId={})",
                rejection, candidate.title, seconds, bounds, candidate.videoId
            )
            null
        }
    }

    /**
     * Acceptable video length for a track.
     * - At most half the track's length cannot carry the whole song; the floor never drops
     *   below [MIN_SHORTS_CUTOFF_SECONDS].
     * - Over twice the track is a concert or album, not the MV (story MVs run only a minute or
     *   two over). No upper bound when the track length is unknown.
     */
    private data class DurationBounds(val minExclusiveSeconds: Long, val maxInclusiveSeconds: Long?) {
        fun rejectionReason(seconds: Long): String? = when {
            seconds <= minExclusiveSeconds -> "Shorts-length"
            maxInclusiveSeconds != null && seconds > maxInclusiveSeconds -> "over-length"
            else -> null
        }

        override fun toString(): String = "($minExclusiveSeconds, ${maxInclusiveSeconds ?: "∞"}]"

        companion object {
            fun forTrack(trackDurationSeconds: Int?): DurationBounds {
                if (trackDurationSeconds == null || trackDurationSeconds <= 0) {
                    return DurationBounds(MIN_SHORTS_CUTOFF_SECONDS, null)
                }
                return DurationBounds(
                    minExclusiveSeconds = maxOf(trackDurationSeconds / 2L, MIN_SHORTS_CUTOFF_SECONDS),
                    maxInclusiveSeconds = trackDurationSeconds * 2L,
                )
            }
        }
    }

    private fun parseDurationSeconds(isoDuration: String): Long? =
        runCatching { Duration.parse(isoDuration).seconds }.getOrNull()

    private fun isShortsTitle(title: String): Boolean = SHORTS_TITLE_RE.containsMatchIn(title)

    private fun mvCandidate(
        source: String,
        videoId: String,
        title: String,
        channelId: String?,
        channelTitle: String,
        songTitle: String,
        artist: String,
    ): MvCandidate {
        val isLive = LIVE_TITLE_RE.containsMatchIn(title)
        val ownChannel = channelMatchesArtistOrMember(artist, channelTitle)
        // The song's own title may contain a bad-title word ("ギターと孤独と蒼い惑星").
        val titleWithoutSong = withoutSongTitle(title, songTitle)
        return MvCandidate(
            source = source,
            videoId = videoId,
            title = title,
            channelId = channelId,
            channelTitle = channelTitle,
            score = scoreMvCandidate(title, channelTitle, artist),
            isLive = isLive,
            // A publisher channel hosts many artists and same-titled swaps, so its upload must name the
            // artist; an artist's own channel rarely repeats its name in the title.
            artistVerified = ownChannel || titleNamesArtist(title, artist),
            officialSource = ownChannel ||
                KNOWN_PUBLISHER_CHANNEL_RE.containsMatchIn(channelTitle) ||
                OFFICIAL_TITLE_RE.containsMatchIn(title),
            badTitle = BAD_TITLE_RE.containsMatchIn(titleWithoutSong),
            isOfficialLyricVideo = ownChannel && !isLive && LYRIC_VIDEO_RE.containsMatchIn(title) &&
                !BAD_TITLE_RE.containsMatchIn(titleWithoutSong.replace(LYRIC_VIDEO_RE, "")),
        )
    }

    private fun withoutSongTitle(videoTitle: String, songTitle: String): String =
        (listOf(songTitle.replace(TRAILING_DESCRIPTOR_RE, "")) + songTitle.split(TITLE_SEPARATOR_RE))
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .sortedByDescending { it.length }
            .fold(videoTitle) { remaining, part -> remaining.replace(part, " ", ignoreCase = true) }

    private fun titleNamesArtist(title: String, artist: String): Boolean {
        val normalizedArtist = normalizeForMatch(ArtistCredit.withoutFeaturing(artist))
        return normalizedArtist.isNotBlank() && normalizeForMatch(title).contains(normalizedArtist)
    }

    private fun maybeCacheArtistChannel(artist: String, candidate: MvCandidate) {
        val channelId = candidate.channelId ?: return
        if (isTopicChannel(candidate.channelTitle)) return
        if (!isCacheableChannel(artist, candidate)) return

        val channel = youtubeClient.getChannel(channelId) ?: return
        val uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads
        artistChannelCache.put(
            artistName = artist,
            value = ArtistChannelCacheEntry(
                artistName = artist,
                channelId = channel.id,
                uploadsPlaylistId = uploadsPlaylistId,
                channelTitle = channel.snippet?.title ?: candidate.channelTitle
            )
        )
        logger.info(
            "Cached YouTube channel '{}' for artist '{}' via MV '{}'",
            channel.snippet?.title ?: candidate.channelTitle,
            artist,
            candidate.title
        )
    }

    /**
     * Only the artist's own or a known publisher channel may be cached; an "Official Music Video"
     * title is not enough, or another artist's channel would own every later lookup.
     */
    private fun isCacheableChannel(artist: String, candidate: MvCandidate): Boolean =
        channelMatchesArtist(artist, candidate.channelTitle) ||
            KNOWN_PUBLISHER_CHANNEL_RE.containsMatchIn(candidate.channelTitle)

    private fun channelMatchesArtist(artist: String, channelTitle: String): Boolean =
        nameMatchesChannel(normalizeForMatch(ArtistCredit.withoutFeaturing(artist)), channelTitle)

    /**
     * A collaboration ("niki & リリィ") is uploaded on one member's channel, so each member counts. Not
     * used for caching, where a member's channel would own the whole collaboration's lookups.
     */
    private fun channelMatchesArtistOrMember(artist: String, channelTitle: String): Boolean {
        if (channelMatchesArtist(artist, channelTitle)) return true
        return ArtistCredit.withoutFeaturing(artist)
            .split(ARTIST_SEPARATOR_RE)
            .map { normalizeForMatch(it) }
            .filter { it.length >= MIN_TITLE_PART_LENGTH }
            .any { nameMatchesChannel(it, channelTitle) }
    }

    private fun nameMatchesChannel(normalizedName: String, channelTitle: String): Boolean {
        val normalizedChannel = normalizeForMatch(channelTitle)
        return normalizedName.isNotBlank() &&
            (normalizedName.contains(normalizedChannel) || normalizedChannel.contains(normalizedName))
    }

    private fun titleMatches(videoTitle: String, targetTitle: String): Boolean {
        val normalizedVideoTitle = normalizeForMatch(videoTitle)
        return targetTitleVariants(targetTitle).any { normalizedVideoTitle.contains(it) }
    }

    /**
     * Catalog titles are often bilingual ("ピースサイン - Peace Sign") while an upload carries one half,
     * so each separator-delimited part is its own variant. Single-character parts are too ambiguous.
     */
    private fun targetTitleVariants(title: String): List<String> {
        val withoutTrailingDescriptor = title.replace(TRAILING_DESCRIPTOR_RE, "")
        val parts = withoutTrailingDescriptor.split(TITLE_SEPARATOR_RE)
            .map { normalizeForMatch(it) }
            .filter { it.length >= MIN_TITLE_PART_LENGTH }
        return (listOf(normalizeForMatch(title), normalizeForMatch(withoutTrailingDescriptor)) + parts)
            .filter { it.isNotBlank() }
            .distinct()
    }

    private fun scoreMvCandidate(title: String, channelTitle: String, artist: String): Int {
        val normalizedTitle = normalizeForMatch(title)
        val normalizedChannel = normalizeForMatch(channelTitle)
        val normalizedArtist = normalizeForMatch(ArtistCredit.withoutFeaturing(artist))

        var score = 0
        if (OFFICIAL_TITLE_RE.containsMatchIn(title)) score += 5
        if (BAD_TITLE_RE.containsMatchIn(title)) score -= 10
        if (LIVE_TITLE_RE.containsMatchIn(title)) score -= LIVE_TITLE_PENALTY
        if (HANGUL_RE.containsMatchIn(channelTitle) && !HANGUL_RE.containsMatchIn(artist)) score -= 10
        if (normalizedArtist.isNotBlank() && normalizedChannel.contains(normalizedArtist)) score += 3
        if (normalizedArtist.isNotBlank() && normalizedTitle.startsWith(normalizedArtist)) score += 1
        return score
    }

    private fun isTopicChannel(channelTitle: String): Boolean =
        channelTitle.trim().endsWith("- Topic", ignoreCase = true)

    private fun youtubeUrl(videoId: String): String =
        "https://www.youtube.com/watch?v=$videoId"

    private fun normalizeForMatch(value: String): String =
        Normalizer.normalize(value, Normalizer.Form.NFKC)
            .lowercase()
            .replace(HTML_ENTITY_RE, " ")
            .replace(PUNCTUATION_RE, "")
            .replace(WHITESPACE_RE, "")

    /**
     * @param isLive the title marks a live/tour/concert performance; loses to an MV, accepted by
     *   [pickArtistLive] when no MV exists.
     * @param artistVerified the channel is the artist's own or the title names the artist.
     * @param officialSource from the artist, a known publisher, or titled as official. Without
     *   it the upload is a stranger's reupload, which ranks below the artist's own live.
     */
    private data class MvCandidate(
        val source: String,
        val videoId: String,
        val title: String,
        val channelId: String?,
        val channelTitle: String,
        val score: Int,
        val isLive: Boolean,
        val artistVerified: Boolean,
        val officialSource: Boolean,
        /** A bad-title word outside the song's own title: off-vocal, cover, karaoke and the like. */
        val badTitle: Boolean,
        val isOfficialLyricVideo: Boolean,
    ) {
        val scoreWithoutLivePenalty: Int
            get() = if (isLive) score + LIVE_TITLE_PENALTY else score

        fun trace(durationSeconds: Long?, rejection: String?) = MvSearchCandidate(
            source = source,
            videoId = videoId,
            title = title,
            channelTitle = channelTitle,
            durationSeconds = durationSeconds,
            rejection = rejection,
            score = score,
            artistVerified = artistVerified,
            officialSource = officialSource,
            live = isLive,
        )
    }

    companion object {
        private const val FALLBACK_MAX_RESULTS = 15
        private const val ORDER_VIEW_COUNT = "viewCount"
        private const val SOURCE_UPLOADS = "uploads"
        private const val SOURCE_SEARCH = "search"
        private const val SOURCE_SEARCH_BY_VIEWS = "search:viewCount"
        private const val REJECT_TITLE_MISMATCH = "title-mismatch"
        private const val REJECT_SHORTS_TAG = "shorts-tag"
        private const val MAX_PLAYLIST_PAGES = 4
        private const val PLAYLIST_PAGE_SIZE = 50
        private const val MIN_ACCEPTABLE_SCORE = 0
        private const val LIVE_TITLE_PENALTY = 10

        private const val MIN_SHORTS_CUTOFF_SECONDS = 60L
        private const val MIN_TITLE_PART_LENGTH = 2

        // Narrower than plain "MV" (AMV/MAD/original-MV covers). "非公式" contains "公式" and must not match.
        private val OFFICIAL_TITLE_RE = Regex(
            "Music Video|Official Video|Official MV|オフィシャル|(?<!非)公式",
            RegexOption.IGNORE_CASE
        )
        // Not the song as recorded (other performer, arrangement, no vocals, partial). A cut-down
        // upload can pass the duration bounds, so the title must catch it.
        private val BAD_TITLE_RE = Regex(
            "弾いてみた|歌ってみた|cover|covered by|ピアノ|ギター|drum|アレンジ|off vocal|ニコカラ|字幕|歌詞|한글자막|中文字幕|ローマ字|lyrics|lyric video|the first take|game size|アナザーボーカル|AMV|MAD|非公式|unofficial|エイプリルフール|april fool" +
                "|カラオケ|karaoke|instrumental|short ver|ショートver|ショートバージョン|tv size|tvサイズ",
            RegexOption.IGNORE_CASE
        )
        // Live clips often run exactly the track length, so only the title tells them from the MV.
        // Lookarounds instead of \b: its Unicode handling differs across JDKs ("LIVE映像" must match).
        private val LIVE_TITLE_RE = Regex(
            "(?<![a-z])(?:live|tour|concert)(?![a-z])|ライブ|ライヴ|ツアー|コンサート|フェス",
            RegexOption.IGNORE_CASE
        )
        private val LYRIC_VIDEO_RE = Regex("lyric video", RegexOption.IGNORE_CASE)
        private val HANGUL_RE = Regex("""[\uAC00-\uD7AF]""")
        private val KNOWN_PUBLISHER_CHANNEL_RE = Regex(
            "プロジェクトセカイ|HATSUNE MIKU: COLORFUL STAGE",
            RegexOption.IGNORE_CASE
        )
        private val SHORTS_TITLE_RE = Regex("""[#＃](?:shorts?|ショート)""", RegexOption.IGNORE_CASE)
        private val TRAILING_DESCRIPTOR_RE = Regex("""\s*[\[(（【].*?[】）)\]]\s*$""")
        private val TITLE_SEPARATOR_RE = Regex("""\s+[-–—/／|｜]\s+""")
        // No "×": unit names use it ("ワンダーランズ×ショウタイム").
        private val ARTIST_SEPARATOR_RE = Regex("""\s*(?:&|＆|,|、)\s*""")
        private val HTML_ENTITY_RE = Regex("""&(?:amp|quot|#39|apos);""", RegexOption.IGNORE_CASE)
        private val PUNCTUATION_RE = Regex("""[\p{P}\p{S}]""")
        private val WHITESPACE_RE = Regex("""\s+""")
    }
}
