package com.japanese.vocabulary.song.service

import com.japanese.vocabulary.common.text.ArtistCredit
import com.japanese.vocabulary.song.cache.ArtistChannelCache
import com.japanese.vocabulary.song.cache.ArtistChannelCacheEntry
import com.japanese.vocabulary.mvsearch.client.youtube.YoutubeClient
import com.japanese.vocabulary.mvsearch.client.youtube.YoutubePlayability
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
        val runnerUp = pickRunnerUp(leftovers) ?: return MvSearchResult(null, trace)
        maybeCacheArtistChannel(artist, runnerUp)
        return MvSearchResult(youtubeUrl(runnerUp.videoId), trace)
    }

    /**
     * Whether the song's current MV would still be taken if it were the only candidate. A search that
     * finds nothing keeps a current MV that passes and drops one the rules now reject.
     * A YouTube error propagates: it must never be read as "the MV is gone".
     */
    fun acceptsAsOnlyCandidate(videoId: String, title: String, artist: String, trackDurationSeconds: Int?): Boolean {
        val video = youtubeClient.getVideo(videoId) ?: return false
        val snippet = video.snippet ?: return false
        if (!titleMatches(snippet.title, title) || isShortsTitle(snippet.title) || versionMismatch(snippet.title, title)) return false
        if (YoutubePlayability.unplayable(video) != null) return false
        val seconds = parseDurationSeconds(video.contentDetails.duration)
        if (seconds != null && DurationBounds.forTrack(trackDurationSeconds).rejectionReason(seconds) != null) return false
        val only = listOf(mvCandidate(SOURCE_CURRENT, videoId, snippet.title, snippet.channelId, snippet.channelTitle, title, artist))
        return (pickMv(only) ?: pickRunnerUp(only)) != null
    }

    // No tier for a stranger's reupload: it only existed while a missing MV failed the whole analysis,
    // and what it took was mostly reactions, covers and fan videos.
    private fun pickRunnerUp(candidates: List<MvCandidate>): MvCandidate? =
        pickOfficialLyricVideo(candidates) ?: pickArtistLive(candidates)

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
                    val rejection = when {
                        isShortsTitle(item.snippet.title) -> REJECT_SHORTS_TAG
                        versionMismatch(item.snippet.title, title) -> REJECT_VERSION_MISMATCH
                        else -> null
                    }
                    if (rejection != null) {
                        trace += MvSearchCandidate.rejected(SOURCE_UPLOADS, videoId, item.snippet.title, item.snippet.channelTitle, rejection)
                    } else {
                        matches += mvCandidate(SOURCE_UPLOADS, videoId, item.snippet.title, item.snippet.channelId, item.snippet.channelTitle, title, artist)
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
                versionMismatch(item.snippet.title, title) -> REJECT_VERSION_MISMATCH
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
     *
     * The same 1-unit call carries playability, so a video the app cannot play (age-restricted,
     * private, embedding off, blocked in KR) is dropped here too; see [YoutubePlayability].
     */
    private fun filterByDuration(
        candidates: List<MvCandidate>,
        bounds: DurationBounds,
        trace: MutableList<MvSearchCandidate>,
    ): List<MvCandidate> {
        if (candidates.isEmpty()) return candidates

        val detailsByVideoId = runCatching {
            youtubeClient.listVideoContentDetails(candidates.map { it.videoId }).associateBy { it.id }
        }.getOrElse { e ->
            logger.warn("YouTube duration lookup failed, keeping all candidates: {}", e.message)
            emptyMap()
        }

        return candidates.mapNotNull { candidate ->
            val details = detailsByVideoId[candidate.videoId]
            val seconds = details?.let { parseDurationSeconds(it.contentDetails.duration) }
            // An MV the app's embedded player cannot play is no MV for the app, however well it matches.
            val rejection = details?.let { YoutubePlayability.unplayable(it) }?.let { "unplayable:${it.name}" }
                ?: seconds?.let { bounds.rejectionReason(it) }
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
        // A mapped channel is the artist's own even when neither its name nor the title says so (ラブライブ!スーパースター!! for Liella!).
        val ownChannel = OfficialArtistChannels.isArtistChannel(channelId, artistNames(artist)) ||
            channelMatchesArtistOrMember(artist, channelTitle) || romanizedOwnChannel(artist, channelTitle) ||
            characterOnProjectChannel(artist, channelTitle, title)
        // The song's own title may contain a bad-title word ("ギターと孤独と蒼い惑星").
        val titleWithoutSong = withoutSongTitle(title, songTitle)
        // A channel calling itself official ("mikitoP Official", "… 公式チャンネル") still needs the title to
        // name the artist; artistVerified holds that.
        val officialChannel = ownChannel ||
            KNOWN_PUBLISHER_CHANNEL_RE.containsMatchIn(channelTitle) ||
            OFFICIAL_CHANNEL_RE.containsMatchIn(channelTitle)
        val officialSource = officialChannel || OFFICIAL_TITLE_RE.containsMatchIn(title)
        return MvCandidate(
            source = source,
            videoId = videoId,
            title = title,
            channelId = channelId,
            channelTitle = channelTitle,
            score = scoreMvCandidate(title, channelTitle, artist, ownChannel),
            isLive = isLive,
            // A publisher channel hosts many artists and same-titled swaps, so its upload must name the
            // artist; an artist's own channel rarely repeats its name in the title. The song's version tag
            // ("[Japanese Ver.]") is specific enough to stand in for an abbreviated name (TXT), but only on a
            // channel-side official source: anyone can title an upload "Official MV".
            artistVerified = ownChannel || titleNamesArtist(title, artist) ||
                (officialChannel && titleCarriesVersionTags(title, songTitle)),
            officialSource = officialSource,
            badTitle = isBadTitle(titleWithoutSong, ownChannel),
            isOfficialLyricVideo = ownChannel && !isLive && LYRIC_VIDEO_RE.containsMatchIn(title) &&
                !isBadTitle(titleWithoutSong.replace(LYRIC_VIDEO_RE, ""), ownChannel),
        )
    }

    // On the artist's own channel a cover is the artist's own take, which is the song we have (an utaite such as まふまふ).
    private fun isBadTitle(title: String, ownChannel: Boolean): Boolean =
        BAD_TITLE_RE.containsMatchIn(title) || (!ownChannel && COVER_TITLE_RE.containsMatchIn(title))

    private fun withoutSongTitle(videoTitle: String, songTitle: String): String =
        (listOf(songTitle.replace(TRAILING_DESCRIPTOR_RE, "")) + songTitle.split(TITLE_SEPARATOR_RE))
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .sortedByDescending { it.length }
            .fold(videoTitle) { remaining, part -> remaining.replace(part, " ", ignoreCase = true) }

    /** The whole credit, or for a collaboration ("Aqu3ra, 超かぐや姫! & 月見ヤチヨ") any one member. */
    private fun titleNamesArtist(title: String, artist: String): Boolean {
        val normalizedTitle = normalizeForMatch(title)
        return artistNames(artist).map(::normalizeForMatch).any { it.length >= MIN_TITLE_PART_LENGTH && normalizedTitle.contains(it) }
    }

    private fun titleCarriesVersionTags(videoTitle: String, songTitle: String): Boolean {
        val tags = VERSION_TAG_RE.findAll(songTitle).map { normalizeForMatch(it.groupValues[1]) }.toList()
        val normalizedVideoTitle = normalizeForMatch(videoTitle)
        return tags.isNotEmpty() && tags.all { it.isNotBlank() && normalizedVideoTitle.contains(it) }
    }

    /**
     * A character credit ("MILGRAM シドウ (CV: 仲村宗悟)") is uploaded on its project's channel, which carries only
     * the first word; the character's name must then be in the title, or every character's song would pass.
     */
    private fun characterOnProjectChannel(artist: String, channelTitle: String, videoTitle: String): Boolean {
        val credit = ArtistCredit.withoutFeaturing(artist)
        if (!VOICE_ACTOR_CREDIT_RE.containsMatchIn(credit)) return false
        val words = credit.replace(VOICE_ACTOR_CREDIT_RE, " ").trim().split(WHITESPACE_RE)
            .map(::normalizeForMatch).filter { it.isNotEmpty() }
        if (words.size < 2 || words.first().length < MIN_TITLE_PART_LENGTH) return false
        // The channel is the project name plus at most its kana reading ("MILGRAM -ミルグラム-"), so a
        // "MILGRAM 歌詞 English Sub" fan channel is not taken for it.
        val channel = normalizeForMatch(channelTitle)
        val rest = channel.removePrefix(words.first())
        if (rest == channel || (rest.isNotEmpty() && !rest.all { Character.UnicodeScript.of(it.code) == Character.UnicodeScript.KATAKANA || it == 'ー' })) {
            return false
        }
        val normalizedTitle = normalizeForMatch(videoTitle)
        return words.drop(1).all { normalizedTitle.contains(it) }
    }

    private fun artistNames(artist: String): List<String> {
        val credit = ArtistCredit.withoutFeaturing(artist)
        // "wowaka(現実逃避P)": the alias in brackets is not how the title names the artist.
        return (listOf(credit, credit.replace(TRAILING_DESCRIPTOR_RE, "")) + credit.split(ARTIST_SEPARATOR_RE))
            .map { it.trim() }.filter { it.isNotEmpty() }.distinct()
    }

    /**
     * The artist's own channel under a romanized name (稲葉曇 → "inabakumori", ゆこぴ → "Yukopi"). Every word of the
     * channel name other than an "official"/"channel" word must be the name itself, so "Kenshi Yonezu fanTR" fails.
     * An all-Latin artist is left to [channelMatchesArtistOrMember]; there is nothing to romanize.
     */
    private fun romanizedOwnChannel(artist: String, channelTitle: String): Boolean {
        val words = spacedForMatch(channelTitle).split(' ').filter { it.isNotBlank() && it !in OFFICIAL_CHANNEL_WORDS }
        if (words.isEmpty() || words.any { word -> !word.all { it in 'a'..'z' || it in '0'..'9' } }) return false
        val channel = RomanizedName.latinSkeleton(words.joinToString(""))
        if (channel.length < MIN_ROMANIZED_SKELETON) return false
        return artistNames(artist)
            .filter { name -> name.any { it.code > 0x7F } }
            .any { RomanizedName.skeleton(it) == channel }
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
        val spacedVideoTitle by lazy { " ${spacedForMatch(videoTitle)} " }
        return targetTitleVariants(targetTitle, ::normalizeForMatch).any { variant ->
            // A one- to three-letter title sits inside other songs' titles ("花" in "花火"), so it must stand alone.
            if (variant.codePointCount(0, variant.length) > MAX_SHORT_TITLE_LENGTH) return@any normalizedVideoTitle.contains(variant)
            targetTitleVariants(targetTitle, ::spacedForMatch)
                .filter { normalizeForMatch(it) == variant }
                .any { spacedVideoTitle.contains(" $it ") }
        } || romanizedTitleMatches(videoTitle, targetTitle)
    }

    /**
     * Overseas uploads spell a kana-only title in romaji ("まつり" → "Matsuri"). Whole words only, so a romanized
     * title cannot match the start of a longer word ("hana" in "Hanabi").
     */
    private fun romanizedTitleMatches(videoTitle: String, targetTitle: String): Boolean {
        val withoutTrailingDescriptor = targetTitle.replace(TRAILING_DESCRIPTOR_RE, "")
        val skeletons = (listOf(withoutTrailingDescriptor) + withoutTrailingDescriptor.split(TITLE_SEPARATOR_RE))
            .map { Normalizer.normalize(it, Normalizer.Form.NFKC).trim() }
            .filter { KANA_ONLY_RE.matches(it) }
            .mapNotNull { RomanizedName.skeleton(it) }
            .filter { it.length >= MIN_ROMANIZED_SKELETON }
            .toSet()
        if (skeletons.isEmpty()) return false
        val words = spacedForMatch(videoTitle).split(' ')
        return words.indices.any { start ->
            words.drop(start)
                .takeWhile { word -> word.all { it in 'a'..'z' } }
                .runningReduce { joined, word -> joined + word }
                .any { RomanizedName.latinSkeleton(it) in skeletons }
        }
    }

    /**
     * A language version or edit the song names (or the upload names and the song does not) is another
     * recording: the Korean MV of a "(Japanese Ver.)" track, the full cut of a "[Movie edit]".
     * Japanese is only required one way, since the plain title of a Japanese song often is the Japanese version.
     */
    private fun versionMismatch(videoTitle: String, songTitle: String): Boolean =
        VERSION_MARKERS.any { (marker, japanese) ->
            val inSong = marker.containsMatchIn(songTitle)
            val inVideo = marker.containsMatchIn(videoTitle)
            (inSong && !inVideo) || (!japanese && inVideo && !inSong)
        }

    /**
     * Catalog titles are often bilingual ("ピースサイン - Peace Sign") while an upload carries one half,
     * so each separator-delimited part is its own variant. Single-character parts are too ambiguous.
     */
    private fun targetTitleVariants(title: String, normalize: (String) -> String): List<String> {
        val withoutTrailingDescriptor = title.replace(TRAILING_DESCRIPTOR_RE, "")
        val parts = withoutTrailingDescriptor.split(TITLE_SEPARATOR_RE)
            .map(normalize)
            // A lone kanji is a word in its own right ("烏 - Raven"); it still must stand alone in the upload title.
            .filter { normalizeForMatch(it).let { part -> part.length >= MIN_TITLE_PART_LENGTH || SINGLE_KANJI_RE.matches(part) } }
        // Uploads romanize a guest credit outside brackets ("feat.鏡音リン" → "feat. Kagamine Rin").
        val withoutFeaturing = ArtistCredit.withoutFeaturing(withoutTrailingDescriptor)
        return (listOf(normalize(title), normalize(withoutTrailingDescriptor), normalize(withoutFeaturing)) + parts)
            .filter { it.isNotBlank() }
            .distinct()
    }

    private fun scoreMvCandidate(title: String, channelTitle: String, artist: String, ownChannel: Boolean): Int {
        val normalizedTitle = normalizeForMatch(title)
        val normalizedChannel = normalizeForMatch(channelTitle)
        val normalizedArtist = normalizeForMatch(ArtistCredit.withoutFeaturing(artist))

        var score = 0
        if (OFFICIAL_TITLE_RE.containsMatchIn(title)) score += 5
        if (isBadTitle(title, ownChannel)) score -= 10
        if (LIVE_TITLE_RE.containsMatchIn(title)) score -= LIVE_TITLE_PENALTY
        // A Korean act's own channel adds its Hangul name ("PLAVE 플레이브").
        if (HANGUL_RE.containsMatchIn(channelTitle) && !HANGUL_RE.containsMatchIn(artist) && !ownChannel) score -= 10
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

    private fun spacedForMatch(value: String): String =
        Normalizer.normalize(value, Normalizer.Form.NFKC)
            .lowercase()
            .replace(HTML_ENTITY_RE, " ")
            .replace(PUNCTUATION_RE, " ")
            .replace(WHITESPACE_RE, " ")
            .trim()

    /**
     * @param isLive the title marks a live/tour/concert performance; loses to an MV, accepted by
     *   [pickArtistLive] when no MV exists.
     * @param artistVerified the channel is the artist's own or the title names the artist.
     * @param officialSource from the artist, a known publisher, or titled as official. Without
     *   it the upload is a stranger's reupload, which is never taken.
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
        private const val SOURCE_CURRENT = "current"
        private const val REJECT_TITLE_MISMATCH = "title-mismatch"
        private const val REJECT_SHORTS_TAG = "shorts-tag"
        private const val REJECT_VERSION_MISMATCH = "version-mismatch"
        private const val MAX_SHORT_TITLE_LENGTH = 3
        private const val MAX_PLAYLIST_PAGES = 4
        private const val PLAYLIST_PAGE_SIZE = 50
        private const val MIN_ACCEPTABLE_SCORE = 0
        private const val LIVE_TITLE_PENALTY = 10

        private const val MIN_SHORTS_CUTOFF_SECONDS = 60L
        private const val MIN_TITLE_PART_LENGTH = 2

        // Narrower than plain "MV" (AMV/MAD/original-MV covers). "非公式" contains "公式" and must not match.
        private val OFFICIAL_TITLE_RE = Regex(
            "Music Video|(?<![a-z])official(?![a-z])|オフィシャル|(?<!非)公式",
            RegexOption.IGNORE_CASE
        )
        private val OFFICIAL_CHANNEL_RE = Regex("(?<![a-z])official(?![a-z])|(?<!非)公式", RegexOption.IGNORE_CASE)
        private val OFFICIAL_CHANNEL_WORDS = setOf("official", "channel", "ch", "music", "youtube", "staff", "公式", "チャンネル", "ちゃんねる")
        // Two consonants match too many names by chance.
        private const val MIN_ROMANIZED_SKELETON = 3
        // Not the song as recorded (other performer, arrangement, no vocals, partial). A cut-down
        // upload can pass the duration bounds, so the title must catch it.
        private val BAD_TITLE_RE = Regex(
            "弾いてみた|ピアノ|ギター|drum|アレンジ|off vocal|ニコカラ|字幕|歌詞|한글자막|中文字幕|ローマ字|lyrics|lyric video|the first take|game size|ゲームサイズ|アナザーボーカル|AMV|MAD|非公式|unofficial|エイプリルフール|april fool" +
                "|カラオケ|karaoke|instrumental|short ver|ショートver|ショートバージョン|tv size|tvサイズ" +
                "|offvocal|off-vocal|[+-]\\d+\\s*key|原曲歌手|ドラム|演奏してみた|叩いてみた|踊ってみた|dance practice|振付" +
                "|trailer|teaser|予告|react|切り抜き|譜面|sonolus|d4dj|グルミク|mashup|』×『|」×「|sped up" +
                "|中文|翻譯|翻訳|(?<![a-z])(?:thai|rus|eng|indo|viet|esp)\\s*sub|thaisub",
            RegexOption.IGNORE_CASE
        )
        // Pairs of (marker, isJapanese); see versionMismatch.
        private val VERSION_MARKERS = listOf(
            Regex("""japanese|日本語|(?<![a-z])jpn?(?![a-z])""", RegexOption.IGNORE_CASE) to true,
            Regex("""english\s*ver|英語ver|英語版""", RegexOption.IGNORE_CASE) to false,
            Regex("""korean\s*ver|韓国語ver|韓国語版""", RegexOption.IGNORE_CASE) to false,
            Regex("""thai\s*ver""", RegexOption.IGNORE_CASE) to false,
            Regex("""chinese\s*ver|中国語ver|中国語版""", RegexOption.IGNORE_CASE) to false,
            Regex("""movie\s*edit""", RegexOption.IGNORE_CASE) to false,
        )
        // Live clips often run exactly the track length, so only the title tells them from the MV.
        // Lookarounds instead of \b: its Unicode handling differs across JDKs ("LIVE映像" must match).
        private val LIVE_TITLE_RE = Regex(
            "(?<![a-z])(?:live|tour|concert|fes|festival)(?![a-z])|ライブ|ライヴ|ツアー|コンサート|フェス|fuji\\s*rock|summer\\s*sonic" +
                // A stage take is titled "'Song' @ venue"; a producer handle such as "cosMo@暴走P" has a letter before the @.
                "|(?<![a-z0-9])@",
            RegexOption.IGNORE_CASE
        )
        private val COVER_TITLE_RE = Regex("歌ってみた|cover", RegexOption.IGNORE_CASE)
        private val LYRIC_VIDEO_RE = Regex("lyric video", RegexOption.IGNORE_CASE)
        private val HANGUL_RE = Regex("""[\uAC00-\uD7AF]""")
        private val SINGLE_KANJI_RE = Regex("""\p{IsHan}""")
        private val KANA_ONLY_RE = Regex("""[ぁ-ゖァ-ヺー\s]+""")
        private val VERSION_TAG_RE = Regex("""[\[(（【]([^\[\]()（）【】]*?(?<![a-z])ver(?:sion)?\.?)\s*[】）)\]]""", RegexOption.IGNORE_CASE)
        private val VOICE_ACTOR_CREDIT_RE = Regex("""[(（]\s*CV\s*[.:：].*?[)）]""", RegexOption.IGNORE_CASE)
        // Label and IP channels that upload many artists' MVs; an upload must still name the artist.
        private val KNOWN_PUBLISHER_CHANNEL_RE = Regex(
            "プロジェクトセカイ|HATSUNE MIKU: COLORFUL STAGE|^SMTOWN$|^HYBE LABELS$|ラブライブ|Love Live!|あんスタチャンネル|^U/M/A/A|^SPACE SHOWER",
            RegexOption.IGNORE_CASE
        )
        private val SHORTS_TITLE_RE = Regex("""[#＃](?:shorts?|ショート)""", RegexOption.IGNORE_CASE)
        private val TRAILING_DESCRIPTOR_RE = Regex("""\s*[\[(（【].*?[】）)\]]\s*$""")
        // A dash glued to a trailing "!"/"?" ("いつか!- Sayonara") still separates; "Spider-Man" does not.
        private val TITLE_SEPARATOR_RE = Regex("""\s+[-–—/／|｜]\s+|(?<=[!！?？])[-–—]\s+""")
        // No "×": unit names use it ("ワンダーランズ×ショウタイム").
        private val ARTIST_SEPARATOR_RE = Regex("""\s*(?:&|＆|,|、)\s*""")
        private val HTML_ENTITY_RE = Regex("""&(?:amp|quot|#39|apos);""", RegexOption.IGNORE_CASE)
        private val PUNCTUATION_RE = Regex("""[\p{P}\p{S}]""")
        private val WHITESPACE_RE = Regex("""\s+""")
    }
}
