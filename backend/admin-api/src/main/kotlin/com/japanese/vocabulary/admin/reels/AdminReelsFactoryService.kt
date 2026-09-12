package com.japanese.vocabulary.admin.reels

import com.japanese.vocabulary.admin.dto.reels.AdminReelsLyricLineResponse
import com.japanese.vocabulary.admin.dto.reels.AdminReelsLyricTokenResponse
import com.japanese.vocabulary.admin.dto.reels.AdminReelsRenderRequest
import com.japanese.vocabulary.admin.dto.reels.AdminReelsSongCandidateResponse
import com.japanese.vocabulary.admin.dto.reels.AdminReelsSongDetailResponse
import com.japanese.vocabulary.admin.dto.reels.AdminReelsVocabularyResponse
import com.japanese.vocabulary.admin.repository.AdminLyricRepository
import com.japanese.vocabulary.admin.repository.AdminSongRepository
import com.japanese.vocabulary.admin.reels.model.AdminReelsPromoData
import com.japanese.vocabulary.admin.reels.model.AdminReelsPromoLine
import com.japanese.vocabulary.admin.reels.model.AdminReelsPromoSong
import com.japanese.vocabulary.admin.reels.model.AdminReelsPromoToken
import com.japanese.vocabulary.admin.reels.model.AdminReelsRenderInput
import com.japanese.vocabulary.admin.reels.model.AdminReelsRenderSource
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.LyricLineData
import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.song.model.Token
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.nio.file.Path
import java.net.URI
import kotlin.math.roundToInt

@Service
class AdminReelsFactoryService(
    private val songRepository: AdminSongRepository,
    private val lyricRepository: AdminLyricRepository,
    private val renderService: AdminReelsRenderService,
) {
    @Transactional(readOnly = true)
    fun listSongs(query: String?, pageable: Pageable): Page<AdminReelsSongCandidateResponse> {
        val page = query?.trim()?.takeIf { it.isNotEmpty() }
            ?.let { songRepository.findByTitleContainingIgnoreCaseOrArtistContainingIgnoreCase(it, it, pageable) }
            ?: songRepository.findAll(pageable)
        val lyricBySongId = lyricRepository.findActiveBySongIdIn(page.content.mapNotNull { it.id }).associateBy { it.songId }
        return page.map { song -> song.toCandidateResponse(lyricBySongId[song.id]) }
    }

    @Transactional(readOnly = true)
    fun getSong(songId: Long): AdminReelsSongDetailResponse {
        val song = songRepository.findById(songId).orElseThrow { NoSuchElementException("Song not found") }
        val lyric = lyricRepository.findActiveBySongId(songId) ?: throw NoSuchElementException("Lyric not found")
        return detailResponse(song, lyric)
    }

    @Transactional(readOnly = true)
    fun render(request: AdminReelsRenderRequest): Path {
        val input = buildRenderInput(request)
        return renderService.render(input)
    }

    private fun buildRenderInput(request: AdminReelsRenderRequest): AdminReelsRenderInput {
        if (!request.acknowledgeSourceRightsAndPlatformRisk) {
            throw IllegalArgumentException("source rights and platform risk acknowledgement is required")
        }
        val uniqueIndexes = request.lineIndexes.distinct()
        if (request.lineIndexes.size != uniqueIndexes.size) {
            throw IllegalArgumentException("lineIndexes must not contain duplicates")
        }
        if (uniqueIndexes.size < MIN_LINE_COUNT) {
            throw IllegalArgumentException("lineIndexes must contain at least $MIN_LINE_COUNT lines")
        }

        val song = songRepository.findById(request.songId).orElseThrow { NoSuchElementException("Song not found") }
        val youtubeUrl = song.youtubeUrl?.takeIf { it.isNotBlank() }
            ?: throw IllegalArgumentException("song must have youtubeUrl")
        validateYoutubeUrl(youtubeUrl)
        val lyric = lyricRepository.findActiveBySongId(request.songId) ?: throw NoSuchElementException("Lyric not found")
        val analyzedByIndex = lyric.analyzedContent?.associateBy { it.index }
            ?: throw IllegalArgumentException("song must have analyzed lyrics")
        val rawByIndex = lyric.rawContent.associateBy { it.index }

        val selected = uniqueIndexes.map { index ->
            val raw = rawByIndex[index] ?: throw IllegalArgumentException("selected line index $index is not present")
            val analyzed = analyzedByIndex[index] ?: throw IllegalArgumentException("selected line index $index is not analyzed")
            if (raw.startTimeMs == null) {
                throw IllegalArgumentException("selected line index $index is missing timing")
            }
            raw to analyzed
        }
        val firstMs = requireNotNull(selected.first().first.startTimeMs)
        val sourceStartFrame = (firstMs / 1000.0 * FPS).roundToInt()

        val promoLines = selected.map { (raw, analyzed) ->
            val startFrame = (((requireNotNull(raw.startTimeMs) - firstMs).coerceAtLeast(0)) / 1000.0 * FPS).roundToInt()
            AdminReelsPromoLine(
                startFrame = startFrame,
                originalText = raw.text,
                koreanLyrics = analyzed.koreanLyrics.orEmpty(),
                tokens = analyzed.tokens.map {
                    AdminReelsPromoToken(
                        surface = it.surface,
                        baseForm = it.baseForm,
                        reading = it.reading,
                        baseFormReading = it.baseFormReading,
                        partOfSpeech = it.partOfSpeech.name,
                        charStart = it.charStart,
                        charEnd = it.charEnd,
                        koreanText = it.koreanText,
                        jlpt = it.jlpt,
                    )
                },
                vocabulary = vocabularyFor(analyzed),
            )
        }

        return AdminReelsRenderInput(
            source = AdminReelsRenderSource(youtubeUrl = youtubeUrl),
            data = AdminReelsPromoData(
                song = AdminReelsPromoSong(
                    title = song.title,
                    artist = song.artist,
                    artworkAsset = song.artworkUrl.orEmpty(),
                    mvAsset = "",
                ),
                headline = headlineFor(song, lyric),
                instagramHandle = INSTAGRAM_HANDLE,
                catchphrase = CATCHPHRASE,
                sourceStartFrame = sourceStartFrame,
                lyricLines = promoLines,
                wordCount = promoLines.flatMap { line -> line.vocabulary }
                    .distinctBy { word -> word.japanese }
                    .size,
            ),
        )
    }

    private fun detailResponse(song: SongEntity, lyric: LyricEntity): AdminReelsSongDetailResponse {
        val analyzedByIndex = lyric.analyzedContent?.associateBy { it.index }.orEmpty()
        return AdminReelsSongDetailResponse(
            song = song.toCandidateResponse(lyric),
            headline = headlineFor(song, lyric),
            instagramHandle = INSTAGRAM_HANDLE,
            catchphrase = CATCHPHRASE,
            minLineCount = MIN_LINE_COUNT,
            maxLineCount = null,
            lines = lyric.rawContent.map { raw ->
                val analyzed = analyzedByIndex[raw.index]
                AdminReelsLyricLineResponse(
                    index = raw.index,
                    startTimeMs = raw.startTimeMs,
                    originalText = raw.text,
                    koreanLyrics = analyzed?.koreanLyrics,
                    tokens = analyzed?.tokens?.map { it.toResponse() }.orEmpty(),
                    recommendedVocabulary = analyzed?.let { vocabularyFor(it) }.orEmpty(),
                    selectable = analyzed != null && raw.startTimeMs != null,
                    ineligibleReason = when {
                        analyzed == null -> "not_analyzed"
                        raw.startTimeMs == null -> "missing_timing"
                        else -> null
                    },
                )
            },
        )
    }

    private fun SongEntity.toCandidateResponse(lyric: LyricEntity?): AdminReelsSongCandidateResponse {
        val youtubeReason = youtubeUrl?.let { youtubeUrlIneligibleReason(it) }
        val reason = when {
            youtubeUrl.isNullOrBlank() -> "missing_youtube_url"
            youtubeReason != null -> youtubeReason
            lyric?.analyzedContent.isNullOrEmpty() -> "missing_analyzed_lyrics"
            else -> null
        }
        return AdminReelsSongCandidateResponse(
            id = requireNotNull(id),
            title = title,
            artist = artist,
            durationSeconds = durationSeconds,
            youtubeUrl = youtubeUrl,
            artworkUrl = artworkUrl,
            hasAnalyzedLyrics = !lyric?.analyzedContent.isNullOrEmpty(),
            renderEligible = reason == null,
            ineligibleReason = reason,
        )
    }

    private fun Token.toResponse(): AdminReelsLyricTokenResponse = AdminReelsLyricTokenResponse(
        surface = surface,
        baseForm = baseForm,
        reading = reading,
        baseFormReading = baseFormReading,
        partOfSpeech = partOfSpeech.name,
        charStart = charStart,
        charEnd = charEnd,
        koreanText = koreanText,
        jlpt = jlpt,
    )

    private fun vocabularyFor(analyzed: AnalyzedLine): List<AdminReelsVocabularyResponse> {
        return analyzed.tokens
            .asSequence()
            .filter { it.jlpt == "N5" || it.jlpt == "N4" }
            .filter { it.partOfSpeech != PartOfSpeech.SYMBOL && it.partOfSpeech != PartOfSpeech.PARTICLE }
            .filter { !it.koreanText.isNullOrBlank() }
            .distinctBy { it.baseForm.ifBlank { it.surface } }
            .take(2)
            .map {
                AdminReelsVocabularyResponse(
                    japanese = it.baseForm.ifBlank { it.surface },
                    reading = it.baseFormReading ?: it.reading ?: "",
                    korean = requireNotNull(it.koreanText),
                    partOfSpeech = it.partOfSpeech.name,
                    partOfSpeechLabel = it.partOfSpeech.koreanName,
                    jlpt = it.jlpt,
                )
            }
            .toList()
    }

    private fun headlineFor(song: SongEntity, lyric: LyricEntity): String {
        val firstKorean = lyric.analyzedContent
            ?.firstOrNull { !it.koreanLyrics.isNullOrBlank() }
            ?.koreanLyrics
            ?.replace(Regex("\\s+"), " ")
            ?.take(28)
        return firstKorean ?: "${song.title}에서 배우는 일본어 가사"
    }

    private fun validateYoutubeUrl(url: String) {
        youtubeUrlIneligibleReason(url)?.let { reason ->
            throw IllegalArgumentException(
                when (reason) {
                    "invalid_youtube_url" -> "song youtubeUrl must be a valid URL"
                    "non_https_youtube_url" -> "song youtubeUrl must use https"
                    "missing_youtube_host" -> "song youtubeUrl must have a host"
                    else -> "song youtubeUrl must be a YouTube URL"
                },
            )
        }
    }

    private fun youtubeUrlIneligibleReason(url: String): String? {
        val uri = runCatching { URI(url) }.getOrNull()
            ?: return "invalid_youtube_url"
        if (uri.scheme != "https") {
            return "non_https_youtube_url"
        }
        val host = uri.host?.lowercase()?.removePrefix("www.")
            ?: return "missing_youtube_host"
        if (host != "youtube.com" && host != "youtu.be" && host != "music.youtube.com") {
            return "non_youtube_url"
        }
        return null
    }

    companion object {
        const val MIN_LINE_COUNT = 4
        const val FPS = 30
        const val INSTAGRAM_HANDLE = "@kotonoha.music"
        const val CATCHPHRASE = "가사에서 바로 배우는 일본어"
    }
}
