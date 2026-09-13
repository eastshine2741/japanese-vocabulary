package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.song.cache.ArtistChannelCache
import com.japanese.vocabulary.song.cache.ArtistChannelCacheEntry
import com.japanese.vocabulary.mvsearch.client.youtube.YoutubeClient
import com.japanese.vocabulary.mvsearch.client.youtube.dto.YoutubePlaylistItemDto
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

    fun searchMvUrl(title: String, artist: String, trackDurationSeconds: Int?): String? {
        val durationBounds = DurationBounds.forTrack(trackDurationSeconds)

        artistChannelCache.get(artist)
            ?.let { cached ->
                searchCachedUploads(title, artist, cached, durationBounds)
                    ?.let { return youtubeUrl(it.videoId) }
            }

        val fallback = searchFallback(title, artist, durationBounds) ?: return null
        maybeCacheArtistChannel(artist, fallback)
        return youtubeUrl(fallback.videoId)
    }

    private fun searchCachedUploads(
        title: String,
        artist: String,
        cached: ArtistChannelCacheEntry,
        durationBounds: DurationBounds,
    ): MvCandidate? {
        var pageToken: String? = null
        val matches = mutableListOf<MvCandidate>()
        var pagesRead = 0
        while (pagesRead < MAX_PLAYLIST_PAGES) {
            val response = youtubeClient.listPlaylistItems(
                playlistId = cached.uploadsPlaylistId,
                pageToken = pageToken,
                maxResults = PLAYLIST_PAGE_SIZE
            ) ?: return null
            pagesRead += 1

            // An artist's uploads playlist mixes Shorts and live clips in with MVs, so the
            // title-matched items are collected first and filtered by duration in one batch below.
            matches += response.items.mapNotNull { it.toCandidate(title, artist) }

            pageToken = response.nextPageToken ?: break
        }
        // The artist's own channel is where live/tour clips of the song live, so the same
        // score floor as the broad search applies; a rejected upload falls through to it.
        return filterByDuration(matches, durationBounds)
            .filter { it.score >= MIN_ACCEPTABLE_SCORE }
            .maxByOrNull { it.score }
    }

    private fun searchFallback(title: String, artist: String, durationBounds: DurationBounds): MvCandidate? {
        // MV lookup intentionally uses broad video search, then local ranking:
        // 1. Strip iTunes-style trailing descriptors from the query, e.g. "(feat. ...)".
        // 2. Do not restrict videoCategoryId to Music. Publisher uploads such as
        //    Project SEKAI MVs are categorized as Gaming and would disappear.
        // 3. Keep only title-matching candidates, prefer non-Topic channels, and
        //    fall back to Topic only when every non-Topic candidate looks unsafe.
        val queryTitle = title.replace(TRAILING_DESCRIPTOR_RE, "").trim().ifBlank { title }
        val candidates = youtubeClient.searchVideos(
            query = "$queryTitle $artist",
            maxResults = FALLBACK_MAX_RESULTS,
            videoCategoryId = null
        )?.items
            ?.filter { titleMatches(it.snippet.title, title) }
            ?.mapNotNull { it.toCandidate(artist) }
            ?.let { filterByDuration(it, durationBounds) }
            ?: emptyList()

        val bestNonTopic = candidates
            .filter { !isTopicChannel(it.channelTitle) }
            .filter { it.score >= MIN_ACCEPTABLE_SCORE }
            .maxByOrNull { it.score }
        val fallbackTopic = candidates.firstOrNull { isTopicChannel(it.channelTitle) }

        return bestNonTopic ?: fallbackTopic
    }

    /**
     * The Data API exposes no "is this a Short" or "is this a live clip" flag, so length is
     * the usable proxy: a video far shorter than the track is a Short, a teaser, or a clipped
     * excerpt; one far longer is a full concert, a compilation, or a full album. The iTunes
     * track length drives both bounds; see [DurationBounds.forTrack].
     *
     * Videos whose duration is missing or unparsable are kept — a flaky secondary lookup
     * must not drop a legitimate MV. `P0D` (live/premiere) has no length and is dropped.
     */
    private fun filterByDuration(candidates: List<MvCandidate>, bounds: DurationBounds): List<MvCandidate> {
        if (candidates.isEmpty()) return candidates

        val durationsByVideoId = runCatching {
            youtubeClient.listVideoContentDetails(candidates.map { it.videoId })
                .associate { it.id to parseDurationSeconds(it.contentDetails.duration) }
        }.getOrElse { e ->
            logger.warn("YouTube duration lookup failed, keeping all candidates: {}", e.message)
            emptyMap()
        }

        return candidates.filter { candidate ->
            val seconds = durationsByVideoId[candidate.videoId] ?: return@filter true
            val rejection = bounds.rejectionReason(seconds) ?: return@filter true
            logger.info(
                "Skipping {} YouTube candidate '{}' ({}s, bounds={}, videoId={})",
                rejection, candidate.title, seconds, bounds, candidate.videoId
            )
            false
        }
    }

    /**
     * Acceptable video length for a track.
     * - A video worth half the track's length or less cannot be carrying the whole song. The
     *   floor never drops below [MIN_SHORTS_CUTOFF_SECONDS], so a two-minute song still
     *   rejects a 45s Short.
     * - A video longer than twice the track is not an MV of it. Story MVs run a minute or two
     *   over the track; concerts and full albums run far past 2x. Unknown when the track
     *   length is unknown.
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

    private fun YoutubeSearchItemDto.toCandidate(artist: String): MvCandidate? {
        val videoId = id.videoId ?: return null
        if (isShortsTitle(snippet.title)) return null
        return MvCandidate(
            videoId = videoId,
            title = snippet.title,
            channelId = snippet.channelId,
            channelTitle = snippet.channelTitle,
            score = scoreMvCandidate(snippet.title, snippet.channelTitle, artist)
        )
    }

    private fun YoutubePlaylistItemDto.toCandidate(title: String, artist: String): MvCandidate? {
        val videoId = snippet.resourceId.videoId ?: return null
        if (isShortsTitle(snippet.title)) return null
        if (!titleMatches(snippet.title, title)) return null
        return MvCandidate(
            videoId = videoId,
            title = snippet.title,
            channelId = null,
            channelTitle = snippet.channelTitle,
            score = scoreMvCandidate(snippet.title, snippet.channelTitle, artist)
        )
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

    private fun isCacheableChannel(artist: String, candidate: MvCandidate): Boolean {
        if (candidate.score >= MIN_CACHEABLE_SCORE) return true

        val normalizedArtist = normalizeForMatch(artist)
        val normalizedChannel = normalizeForMatch(candidate.channelTitle)
        val channelMatchesArtist = normalizedArtist.isNotBlank() &&
            (normalizedArtist.contains(normalizedChannel) || normalizedChannel.contains(normalizedArtist))
        val channelIsKnownPublisher = KNOWN_PUBLISHER_CHANNEL_RE.containsMatchIn(candidate.channelTitle)
        return channelMatchesArtist || channelIsKnownPublisher
    }

    private fun titleMatches(videoTitle: String, targetTitle: String): Boolean {
        val normalizedVideoTitle = normalizeForMatch(videoTitle)
        return targetTitleVariants(targetTitle).any { normalizedVideoTitle.contains(it) }
    }

    /**
     * iTunes titles are often bilingual, e.g. "ピースサイン - Peace Sign", while an upload
     * carries only one half or both halves apart, so each separator-delimited part is a
     * variant of its own. Single-character parts are too ambiguous to match on.
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
        val normalizedArtist = normalizeForMatch(artist)

        var score = 0
        if (OFFICIAL_TITLE_RE.containsMatchIn(title)) score += 5
        if (BAD_TITLE_RE.containsMatchIn(title)) score -= 10
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

    private data class MvCandidate(
        val videoId: String,
        val title: String,
        val channelId: String?,
        val channelTitle: String,
        val score: Int,
    )

    companion object {
        private const val FALLBACK_MAX_RESULTS = 15
        private const val MAX_PLAYLIST_PAGES = 4
        private const val PLAYLIST_PAGE_SIZE = 50
        private const val MIN_ACCEPTABLE_SCORE = 0
        private const val MIN_CACHEABLE_SCORE = 1

        private const val MIN_SHORTS_CUTOFF_SECONDS = 60L
        private const val MIN_TITLE_PART_LENGTH = 2

        // Keep this narrower than plain "MV": AMV/MAD/original-MV covers often
        // contain the target title but are not the official/publisher upload.
        private val OFFICIAL_TITLE_RE = Regex(
            "Music Video|Official Video|Official MV|オフィシャル|公式",
            RegexOption.IGNORE_CASE
        )
        // Live/tour clips are the artist's own uploads and often run exactly the track
        // length, so only the title tells them apart from the MV. English words are bounded
        // by explicit lookarounds rather than \b, whose Unicode handling differs across JDKs
        // ("LIVE映像" must still match).
        private val BAD_TITLE_RE = Regex(
            "弾いてみた|歌ってみた|cover|covered by|ピアノ|ギター|drum|アレンジ|off vocal|ニコカラ|字幕|한글자막|中文字幕|ローマ字|lyrics|lyric video|the first take|game size|アナザーボーカル|AMV|MAD" +
                "|(?<![a-z])(?:live|tour|concert)(?![a-z])|ライブ|ライヴ|ツアー|コンサート|フェス|カラオケ|karaoke|instrumental",
            RegexOption.IGNORE_CASE
        )
        private val HANGUL_RE = Regex("""[\uAC00-\uD7AF]""")
        private val KNOWN_PUBLISHER_CHANNEL_RE = Regex(
            "プロジェクトセカイ|HATSUNE MIKU: COLORFUL STAGE",
            RegexOption.IGNORE_CASE
        )
        private val SHORTS_TITLE_RE = Regex("""[#＃](?:shorts?|ショート)""", RegexOption.IGNORE_CASE)
        private val TRAILING_DESCRIPTOR_RE = Regex("""\s*[\[(（【].*?[】）)\]]\s*$""")
        private val TITLE_SEPARATOR_RE = Regex("""\s+[-–—/／|｜]\s+""")
        private val HTML_ENTITY_RE = Regex("""&(?:amp|quot|#39|apos);""", RegexOption.IGNORE_CASE)
        private val PUNCTUATION_RE = Regex("""[\p{P}\p{S}]""")
        private val WHITESPACE_RE = Regex("""\s+""")
    }
}
