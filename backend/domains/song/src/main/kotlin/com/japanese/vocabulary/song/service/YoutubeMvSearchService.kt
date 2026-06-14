package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.song.cache.ArtistChannelCache
import com.japanese.vocabulary.song.cache.ArtistChannelCacheEntry
import com.japanese.vocabulary.song.client.youtube.YoutubeClient
import com.japanese.vocabulary.song.client.youtube.dto.YoutubePlaylistItemDto
import com.japanese.vocabulary.song.client.youtube.dto.YoutubeSearchItemDto
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.text.Normalizer

@Service
class YoutubeMvSearchService(
    private val youtubeClient: YoutubeClient,
    private val artistChannelCache: ArtistChannelCache,
) {
    private val logger = LoggerFactory.getLogger(YoutubeMvSearchService::class.java)

    fun searchMvUrl(title: String, artist: String): String? {
        artistChannelCache.get(artist)
            ?.let { cached ->
                searchCachedUploads(title, artist, cached)?.let { return youtubeUrl(it.videoId) }
            }

        val fallback = searchFallback(title, artist) ?: return null
        maybeCacheArtistChannel(artist, fallback)
        return youtubeUrl(fallback.videoId)
    }

    private fun searchCachedUploads(
        title: String,
        artist: String,
        cached: ArtistChannelCacheEntry,
    ): MvCandidate? {
        var pageToken: String? = null
        var best: MvCandidate? = null
        var pagesRead = 0
        while (pagesRead < MAX_PLAYLIST_PAGES) {
            val response = youtubeClient.listPlaylistItems(
                playlistId = cached.uploadsPlaylistId,
                pageToken = pageToken,
                maxResults = PLAYLIST_PAGE_SIZE
            ) ?: return null
            pagesRead += 1

            response.items
                .mapNotNull { it.toCandidate(title, artist) }
                .maxByOrNull { it.score }
                ?.let { candidate ->
                    if (best == null || candidate.score > best!!.score) {
                        best = candidate
                    }
                }

            pageToken = response.nextPageToken ?: break
        }
        return best
    }

    private fun searchFallback(title: String, artist: String): MvCandidate? {
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
            ?: emptyList()

        val bestNonTopic = candidates
            .filter { !isTopicChannel(it.snippet.channelTitle) }
            .mapNotNull { it.toCandidate(artist) }
            .filter { it.score >= MIN_ACCEPTABLE_SCORE }
            .maxByOrNull { it.score }
        val fallbackTopic = candidates
            .firstOrNull { isTopicChannel(it.snippet.channelTitle) }
            ?.toCandidate(artist)

        return bestNonTopic ?: fallbackTopic
    }

    private fun YoutubeSearchItemDto.toCandidate(artist: String): MvCandidate? {
        val videoId = id.videoId ?: return null
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
        private val TRAILING_DESCRIPTOR_RE = Regex("""\s*[\[(（【].*?[】）)\]]\s*$""")
        private val HTML_ENTITY_RE = Regex("""&(?:amp|quot|#39|apos);""", RegexOption.IGNORE_CASE)
        private val PUNCTUATION_RE = Regex("""[\p{P}\p{S}]""")
        private val WHITESPACE_RE = Regex("""\s+""")
    }
}
