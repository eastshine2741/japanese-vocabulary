package com.japanese.vocabulary.admin.reels

import com.japanese.vocabulary.admin.dto.reels.AdminReelsLyricLineResponse
import com.japanese.vocabulary.admin.dto.reels.AdminReelsLyricTokenResponse
import com.japanese.vocabulary.admin.dto.reels.AdminReelsRenderRequest
import com.japanese.vocabulary.admin.dto.reels.AdminReelsSongCandidateResponse
import com.japanese.vocabulary.admin.dto.reels.AdminReelsSongDetailResponse
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
import org.springframework.web.multipart.MultipartFile
import java.nio.file.Path

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
     * 어드민이 올린 source mp4 를 캐시에 넣고(미리보기 사본 재인코딩 포함) 에디터가 스크럽할 스트리밍 경로를 돌려준다.
     * 여기서 받은 원본은 본 렌더가 그대로 쓴다.
     */
    @Transactional(readOnly = true)
    fun uploadSource(songId: Long, file: MultipartFile): AdminReelsSourceResponse {
        requireEligible(songId)
        if (file.isEmpty) {
            throw IllegalArgumentException("source file is empty")
        }
        sourceCache.store(songId, file.inputStream)
        return AdminReelsSourceResponse(mvPath = mvPath(songId))
    }

    /** 이미 올려 둔 source 가 있으면 다시 올리지 않고 스트리밍 경로만 돌려준다. */
    @Transactional(readOnly = true)
    fun cachedSource(songId: Long): AdminReelsSourceResponse? {
        requireEligible(songId)
        return sourceCache.cached(songId)?.let { AdminReelsSourceResponse(mvPath = mvPath(songId)) }
    }

    /** 미리보기 MV 스트림. 캐시에 있는 곡의 재인코딩 사본만 내준다. */
    @Transactional(readOnly = true)
    fun previewSource(songId: Long, token: String): Path {
        if (!tokenService.validateMediaToken(token, songId)) {
            throw AdminReelsMediaTokenException()
        }
        return sourceCache.cached(songId)?.preview ?: throw NoSuchElementException("Source is not cached")
    }

    @Transactional(readOnly = true)
    fun render(request: AdminReelsRenderRequest): Path {
        requireAcknowledgement(request.acknowledgeSourceRightsAndPlatformRisk)
        requireEligible(request.songId)
        validateRenderData(request.data)
        val source = sourceCache.cached(request.songId)
            ?: throw IllegalArgumentException("source mp4 must be uploaded before render")
        val input = AdminReelsRenderInput(
            source = AdminReelsRenderSource(localPath = source.source.toString()),
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

    private fun mvPath(songId: Long): String =
        "/reels-factory/songs/$songId/mv?token=${tokenService.issueMediaToken(songId)}"

    private fun requireEligible(songId: Long) {
        if (!songRepository.existsById(songId)) throw NoSuchElementException("Song not found")
        val lyric = lyricRepository.findActiveBySongId(songId) ?: throw NoSuchElementException("Lyric not found")
        if (lyric.analyzedContent.isNullOrEmpty()) {
            throw IllegalArgumentException("song must have analyzed lyrics")
        }
    }

    /**
     * 에디터가 만든 타임라인 검증. 줄 시작 프레임은 곡 순서대로 단조 증가해야 하고, 가사 구간은
     * [MAX_LYRICS_SPAN_MS] 를 넘을 수 없다. 줄 텍스트·단어 내용과 곡 제목·아티스트 표기는 어드민이 고른 그대로 믿는다.
     */
    private fun validateRenderData(data: AdminReelsPromoData) {
        if (data.song.title.isBlank() || data.song.artist.isBlank()) {
            throw IllegalArgumentException("song title and artist must not be blank")
        }
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

    /** MV 는 어드민이 직접 올리므로 곡 쪽 조건은 분석된 가사뿐이다. youtubeUrl 은 어디서 받을지 안내용으로만 내려간다. */
    private fun SongEntity.toCandidateResponse(lyric: LyricEntity?): AdminReelsSongCandidateResponse {
        val reason = if (lyric?.analyzedContent.isNullOrEmpty()) "missing_analyzed_lyrics" else null
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
