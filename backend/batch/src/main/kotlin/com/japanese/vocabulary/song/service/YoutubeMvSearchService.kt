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
        val shortsCutoffSeconds = shortsCutoffSeconds(trackDurationSeconds)

        artistChannelCache.get(artist)
            ?.let { cached ->
                searchCachedUploads(title, artist, cached, shortsCutoffSeconds)
                    ?.let { return youtubeUrl(it.videoId) }
            }

        val fallback = searchFallback(title, artist, shortsCutoffSeconds) ?: return null
        maybeCacheArtistChannel(artist, fallback)
        return youtubeUrl(fallback.videoId)
    }

    private fun searchCachedUploads(
        title: String,
        artist: String,
        cached: ArtistChannelCacheEntry,
        shortsCutoffSeconds: Long,
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

            // An artist's uploads playlist mixes Shorts in with MVs, so the title-matched
            // items are collected first and filtered by duration in one batch below.
            matches += response.items.mapNotNull { it.toCandidate(title, artist) }

            pageToken = response.nextPageToken ?: break
        }
        return excludeShorts(matches, shortsCutoffSeconds).maxByOrNull { it.score }
    }

    private fun searchFallback(title: String, artist: String, shortsCutoffSeconds: Long): MvCandidate? {
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
            ?.let { excludeShorts(it, shortsCutoffSeconds) }
            ?: emptyList()

        val bestNonTopic = candidates
            .filter { !isTopicChannel(it.channelTitle) }
            .filter { it.score >= MIN_ACCEPTABLE_SCORE }
            .maxByOrNull { it.score }
        val fallbackTopic = candidates.firstOrNull { isTopicChannel(it.channelTitle) }

        return bestNonTopic ?: fallbackTopic
    }

    /**
     * The Data API exposes no "is this a Short" flag, so length is the usable proxy: a video
     * far shorter than the track it should carry is a Short, a teaser, or a clipped excerpt.
     * The iTunes track length drives the cutoff; see [shortsCutoffSeconds] for the bounds.
     *
     * Videos whose duration is missing or unparsable are kept — a flaky secondary lookup
     * must not drop a legitimate MV. `P0D` (live/premiere) has no length and is dropped.
     */
    private fun excludeShorts(candidates: List<MvCandidate>, cutoffSeconds: Long): List<MvCandidate> {
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
            val isShort = seconds <= cutoffSeconds
            if (isShort) {
                logger.info(
                    "Skipping Shorts-length YouTube candidate '{}' ({}s <= {}s cutoff, videoId={})",
                    candidate.title, seconds, cutoffSeconds, candidate.videoId
                )
            }
            !isShort
        }
    }

    /**
     * A video worth half the track's length or less cannot be carrying the whole song.
     * The cutoff is clamped on both ends:
     * - never below [MIN_SHORTS_CUTOFF_SECONDS], so a two-minute song still rejects a 45s Short;
     * - never above [MAX_SHORTS_CUTOFF_SECONDS], YouTube's own Shorts length cap — a longer
     *   video is not a Short, and rejecting it would be duration matching, not Shorts filtering.
     *
     * An unknown track length falls back to the lower bound alone.
     */
    private fun shortsCutoffSeconds(trackDurationSeconds: Int?): Long {
        val halfTrack = trackDurationSeconds?.let { it / 2L } ?: return MIN_SHORTS_CUTOFF_SECONDS
        return halfTrack.coerceIn(MIN_SHORTS_CUTOFF_SECONDS, MAX_SHORTS_CUTOFF_SECONDS)
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

    private fun targetTitleVariants(title: String): List<String> {
        val normalized = normalizeForMatch(title)
        val withoutTrailingDescriptor = normalizeForMatch(title.replace(TRAILING_DESCRIPTOR_RE, ""))
        return listOf(normalized, withoutTrailingDescriptor)
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
        private const val MAX_SHORTS_CUTOFF_SECONDS = 180L

        // Keep this narrower than plain "MV": AMV/MAD/original-MV covers often
        // contain the target title but are not the official/publisher upload.
        private val OFFICIAL_TITLE_RE = Regex(
            "Music Video|Official Video|Official MV|オフィシャル|公式",
            RegexOption.IGNORE_CASE
        )
        private val BAD_TITLE_RE = Regex(
            "弾いてみた|歌ってみた|cover|covered by|ピアノ|ギター|drum|アレンジ|off vocal|ニコカラ|字幕|한글자막|中文字幕|ローマ字|lyrics|lyric video|the first take|game size|アナザーボーカル|AMV|MAD",
            RegexOption.IGNORE_CASE
        )
        private val HANGUL_RE = Regex("""[\uAC00-\uD7AF]""")
        private val KNOWN_PUBLISHER_CHANNEL_RE = Regex(
            "プロジェクトセカイ|HATSUNE MIKU: COLORFUL STAGE",
            RegexOption.IGNORE_CASE
        )
        private val SHORTS_TITLE_RE = Regex("""[#＃](?:shorts?|ショート)""", RegexOption.IGNORE_CASE)
        private val TRAILING_DESCRIPTOR_RE = Regex("""\s*[\[(（【].*?[】）)\]]\s*$""")
        private val HTML_ENTITY_RE = Regex("""&(?:amp|quot|#39|apos);""", RegexOption.IGNORE_CASE)
        private val PUNCTUATION_RE = Regex("""[\p{P}\p{S}]""")
        private val WHITESPACE_RE = Regex("""\s+""")
    }
}
