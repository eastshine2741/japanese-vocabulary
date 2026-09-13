package com.japanese.vocabulary.admin.reels

import com.japanese.vocabulary.admin.dto.reels.AdminReelsLyricLineResponse
import com.japanese.vocabulary.admin.dto.reels.AdminReelsLyricTokenResponse
import com.japanese.vocabulary.admin.dto.reels.AdminReelsRenderRequest
import com.japanese.vocabulary.admin.dto.reels.AdminReelsSongCandidateResponse
import com.japanese.vocabulary.admin.dto.reels.AdminReelsSongDetailResponse
import com.japanese.vocabulary.admin.dto.reels.AdminReelsSourceRequest
import com.japanese.vocabulary.admin.dto.reels.AdminReelsSourceResponse
import com.japanese.vocabulary.admin.dto.reels.AdminReelsVocabularyResponse
import com.japanese.vocabulary.admin.auth.AdminTokenService
import com.japanese.vocabulary.admin.repository.AdminLyricRepository
import com.japanese.vocabulary.admin.repository.AdminSongRepository
import com.japanese.vocabulary.admin.reels.model.AdminReelsPromoData
import com.japanese.vocabulary.admin.reels.model.AdminReelsRenderInput
import com.japanese.vocabulary.admin.reels.model.AdminReelsRenderSource
import com.japanese.vocabulary.song.entity.LyricEntity
import com.japanese.vocabulary.song.entity.SongEntity
import com.japanese.vocabulary.song.model.AnalyzedLine
import com.japanese.vocabulary.song.model.PartOfSpeech
import com.japanese.vocabulary.song.model.Token
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.nio.file.Path
import java.net.URI

@Service
class AdminReelsFactoryService(
    private val songRepository: AdminSongRepository,
    private val lyricRepository: AdminLyricRepository,
    private val renderService: AdminReelsRenderService,
    private val sourceCache: AdminReelsSourceCache,
    private val tokenService: AdminTokenService,
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

    /**
     * 에디터가 MV 를 스크럽할 수 있게 source mp4 를 캐시에 받아 두고 스트리밍 경로를 돌려준다.
     * 여기서 받은 파일은 본 렌더가 그대로 쓴다.
     */
    @Transactional(readOnly = true)
    fun prepareSource(songId: Long, request: AdminReelsSourceRequest): AdminReelsSourceResponse {
        requireAcknowledgement(request.acknowledgeSourceRightsAndPlatformRisk)
        val youtubeUrl = eligibleYoutubeUrl(songId)
        sourceCache.fetch(youtubeUrl)
        val token = tokenService.issueMediaToken(songId)
        return AdminReelsSourceResponse(mvPath = "/reels-factory/songs/$songId/mv?token=$token")
    }

    /** 미리보기 MV 스트림. 캐시에 있는 파일만 내주고 다운로드는 하지 않는다. */
    @Transactional(readOnly = true)
    fun previewSource(songId: Long, token: String): Path {
        if (!tokenService.validateMediaToken(token, songId)) {
            throw AdminReelsMediaTokenException()
        }
        val song = songRepository.findById(songId).orElseThrow { NoSuchElementException("Song not found") }
        val youtubeUrl = song.youtubeUrl?.takeIf { it.isNotBlank() } ?: throw NoSuchElementException("Song has no youtubeUrl")
        return sourceCache.cached(youtubeUrl) ?: throw NoSuchElementException("Source is not cached")
    }

    @Transactional(readOnly = true)
    fun render(request: AdminReelsRenderRequest): Path {
        requireAcknowledgement(request.acknowledgeSourceRightsAndPlatformRisk)
        val youtubeUrl = eligibleYoutubeUrl(request.songId)
        validateRenderData(request.data)
        val source = sourceCache.fetch(youtubeUrl)
        val input = AdminReelsRenderInput(
            source = AdminReelsRenderSource(youtubeUrl = youtubeUrl, localPath = source.toString()),
            // 렌더 스크립트가 mvAsset 을 채운다. 클라이언트가 넣은 스트리밍 URL 은 버린다.
            data = request.data.copy(song = request.data.song.copy(mvAsset = "")),
        )
        return renderService.render(input)
    }

    private fun requireAcknowledgement(acknowledged: Boolean) {
        if (!acknowledged) {
            throw IllegalArgumentException("source rights and platform risk acknowledgement is required")
        }
    }

    private fun eligibleYoutubeUrl(songId: Long): String {
        val song = songRepository.findById(songId).orElseThrow { NoSuchElementException("Song not found") }
        val youtubeUrl = song.youtubeUrl?.takeIf { it.isNotBlank() }
            ?: throw IllegalArgumentException("song must have youtubeUrl")
        validateYoutubeUrl(youtubeUrl)
        val lyric = lyricRepository.findActiveBySongId(songId) ?: throw NoSuchElementException("Lyric not found")
        if (lyric.analyzedContent.isNullOrEmpty()) {
            throw IllegalArgumentException("song must have analyzed lyrics")
        }
        return youtubeUrl
    }

    /**
     * 에디터가 만든 타임라인 검증. 줄 시작 프레임은 곡 순서대로 단조 증가해야 하고, 가사 구간은
     * [MAX_LYRICS_SPAN_MS] 를 넘을 수 없다. 줄 텍스트·단어 내용은 어드민이 고른 그대로 믿는다.
     */
    private fun validateRenderData(data: AdminReelsPromoData) {
        val lines = data.lyricLines
        if (lines.size < MIN_LINE_COUNT) {
            throw IllegalArgumentException("lyricLines must contain at least $MIN_LINE_COUNT lines")
        }
        if (data.sourceStartFrame < 0) {
            throw IllegalArgumentException("sourceStartFrame must not be negative")
        }
        if (lines.first().startFrame < 0) {
            throw IllegalArgumentException("first line must not start before the clip")
        }
        lines.zipWithNext().forEach { (previous, next) ->
            if (next.startFrame <= previous.startFrame) {
                throw IllegalArgumentException("line start frames must strictly increase")
            }
            if (next.lineNumber <= previous.lineNumber) {
                throw IllegalArgumentException("lines must follow song order")
            }
        }
        if (data.lyricsEndFrame <= lines.last().startFrame) {
            throw IllegalArgumentException("lyricsEndFrame must be after the last line start")
        }
        if (data.lyricsEndFrame > MAX_LYRICS_SPAN_MS * FPS / 1000) {
            throw IllegalArgumentException("lyrics must span at most ${MAX_LYRICS_SPAN_MS / 1000} seconds")
        }
        lines.forEach { line ->
            if (line.originalText.isBlank()) {
                throw IllegalArgumentException("line ${line.lineNumber} has no text")
            }
            if (line.vocabulary.size > MAX_VOCABULARY_PER_LINE) {
                throw IllegalArgumentException("line ${line.lineNumber} may show at most $MAX_VOCABULARY_PER_LINE words")
            }
            if (line.vocabulary.any { it.japanese.isBlank() || it.korean.isBlank() }) {
                throw IllegalArgumentException("line ${line.lineNumber} has a word without text or meaning")
            }
        }
    }

    private fun detailResponse(song: SongEntity, lyric: LyricEntity): AdminReelsSongDetailResponse {
        val analyzedByIndex = lyric.analyzedContent?.associateBy { it.index }.orEmpty()
        return AdminReelsSongDetailResponse(
            song = song.toCandidateResponse(lyric),
            lyricType = lyric.lyricType.name,
            headline = headlineFor(song, lyric),
            instagramHandle = INSTAGRAM_HANDLE,
            catchphrase = CATCHPHRASE,
            fps = FPS,
            minLineCount = MIN_LINE_COUNT,
            maxLineCount = null,
            maxLyricsSpanMs = MAX_LYRICS_SPAN_MS,
            maxVocabularyPerLine = MAX_VOCABULARY_PER_LINE,
            lines = lyric.rawContent.map { raw ->
                val analyzed = analyzedByIndex[raw.index]
                AdminReelsLyricLineResponse(
                    index = raw.index,
                    startTimeMs = raw.startTimeMs,
                    originalText = raw.text,
                    koreanLyrics = analyzed?.koreanLyrics,
                    tokens = analyzed?.tokens?.map { it.toResponse() }.orEmpty(),
                    recommendedVocabulary = analyzed?.let { vocabularyFor(it) }.orEmpty(),
                    // 타이밍은 어드민이 에디터에서 찍으므로 분석만 돼 있으면 고를 수 있다.
                    selectable = analyzed != null,
                    ineligibleReason = if (analyzed == null) "not_analyzed" else null,
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

    /** 에디터의 기본 단어 선택. 어드민이 바꾸지 않으면 이 단어가 릴스에 뜬다. */
    private fun vocabularyFor(analyzed: AnalyzedLine): List<AdminReelsVocabularyResponse> {
        return analyzed.tokens
            .asSequence()
            .filter { it.jlpt == "N5" || it.jlpt == "N4" }
            .filter { it.partOfSpeech != PartOfSpeech.SYMBOL && it.partOfSpeech != PartOfSpeech.PARTICLE }
            .filter { !it.koreanText.isNullOrBlank() }
            .distinctBy { it.baseForm.ifBlank { it.surface } }
            .take(MAX_VOCABULARY_PER_LINE)
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
        /** 릴스 가사 구간 상한. 이 위로는 렌더 시간·메모리가 컨테이너 한도를 넘긴다. */
        const val MAX_LYRICS_SPAN_MS = 60_000L
        /** PromoReel 단어 블록은 두 줄 레이아웃이다(Reel v2 디자인). */
        const val MAX_VOCABULARY_PER_LINE = 2
        const val INSTAGRAM_HANDLE = "@kotonoha.music"
        const val CATCHPHRASE = "가사에서 바로 배우는 일본어"
    }
}
