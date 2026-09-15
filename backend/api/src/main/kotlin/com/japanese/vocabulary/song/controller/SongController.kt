package com.japanese.vocabulary.song.controller

import com.japanese.vocabulary.notification.service.AnalysisNotificationService
import com.japanese.vocabulary.song.dto.AnalyzeSongRequest
import com.japanese.vocabulary.song.dto.RecentSongItemDto
import com.japanese.vocabulary.song.dto.SongAnalysisWorkResponse
import com.japanese.vocabulary.song.dto.SongDto
import com.japanese.vocabulary.song.dto.SongStudyDto
import com.japanese.vocabulary.song.dto.AnalyzedSongDto
import com.japanese.vocabulary.song.dto.songdetail.SongLyricsDto
import com.japanese.vocabulary.song.dto.songdetail.SongStudyBootstrapRequest
import com.japanese.vocabulary.song.dto.songdetail.SongStudyBootstrapResponse
import com.japanese.vocabulary.song.dto.songdetail.WordsInSongDto
import com.japanese.vocabulary.songsearch.dto.SongSearchResponse
import com.japanese.vocabulary.songanalysis.dto.SongAnalysisWorkDto
import com.japanese.vocabulary.song.repository.LyricRepository
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
import com.japanese.vocabulary.song.service.RecentSongService
import com.japanese.vocabulary.song.service.SearchHistoryService
import com.japanese.vocabulary.song.service.SongSearchService
import com.japanese.vocabulary.song.service.SongStudyViewService
import com.japanese.vocabulary.song.service.songdetail.SongDetailQueryService
import com.japanese.vocabulary.song.service.songdetail.SongStudyBootstrapService
import org.springframework.http.ResponseEntity
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/songs")
class SongController(
    private val songStudyViewService: SongStudyViewService,
    private val songAnalysisWorkService: SongAnalysisWorkService,
    private val songSearchService: SongSearchService,
    private val recentSongService: RecentSongService,
    private val searchHistoryService: SearchHistoryService,
    private val songRepository: SongRepository,
    private val lyricRepository: LyricRepository,
    private val songDetailQueryService: SongDetailQueryService,
    private val songStudyBootstrapService: SongStudyBootstrapService,
    private val analysisNotificationService: AnalysisNotificationService,
) {

    private fun currentUserId(): Long =
        SecurityContextHolder.getContext().authentication.principal as Long

    /**
     * 멱등하다: 같은 곡을 몇 번 요청해도 분석은 한 번만 돈다. 이미 단어 분석까지 끝난 곡이면
     * 그 분석 작업을 그대로 돌려주고, 진행 중인 작업이 있으면 서비스가 그것을 재사용한다.
     * 새로 만들었든 재사용했든, 요청한 사용자는 그 작업의 완료 알림을 받는다.
     */
    @PostMapping("/analyze")
    fun analyzeSong(@RequestBody request: AnalyzeSongRequest): ResponseEntity<SongAnalysisWorkResponse> {
        findCompletedAnalysis(request.title, request.artist)?.let {
            return ResponseEntity.ok(it.toResponse())
        }
        val userId = currentUserId()
        val work = songAnalysisWorkService.createOrReuse(
            title = request.title,
            artist = request.artist,
            durationSeconds = request.durationSeconds,
            artworkUrl = request.artworkUrl,
            createdByUserId = userId,
        )
        analysisNotificationService.subscribeRequester(userId, work.workId)
        return ResponseEntity.ok(work.toResponse())
    }

    private fun findCompletedAnalysis(title: String, artist: String): SongAnalysisWorkDto? {
        val song = songRepository.findByArtistAndTitle(artist, title) ?: return null
        val lyric = lyricRepository.findActiveBySongId(song.id!!) ?: return null
        if (lyric.analyzedContent == null) return null
        return songAnalysisWorkService.findLatestCompletedForSong(song.id!!)
    }

    @GetMapping("/analysis-work/{workId}")
    fun getAnalysisWork(@PathVariable workId: Long): ResponseEntity<SongAnalysisWorkResponse> {
        return ResponseEntity.ok(songAnalysisWorkService.getById(workId).toResponse())
    }

    @GetMapping(params = ["title", "artistName"])
    fun getSongByTitleAndArtist(
        @RequestParam title: String,
        @RequestParam artistName: String,
    ): ResponseEntity<SongStudyDto> {
        val entity = songRepository.findByArtistAndTitle(artistName, title)
            ?: return ResponseEntity.noContent().build()

        if (lyricRepository.findActiveBySongId(entity.id!!) == null) {
            return ResponseEntity.noContent().build()
        }

        recentSongService.recordListen(currentUserId(), entity.id!!)
        val analyzed = songStudyViewService.buildAnalyzedSong(entity)
        return ResponseEntity.ok(analyzed.toResponse())
    }

    @GetMapping("/recent")
    fun getRecentSongs(): ResponseEntity<List<RecentSongItemDto>> {
        val songIds = recentSongService.getRecentSongIds(currentUserId())
        if (songIds.isEmpty()) {
            return ResponseEntity.ok(emptyList())
        }

        val songsById = songRepository.findAllById(songIds).associateBy { it.id }

        // Maintain Redis order
        val recentSongs = songIds.mapNotNull { id ->
            songsById[id]?.let { entity ->
                RecentSongItemDto(
                    id = entity.id!!,
                    title = entity.title,
                    artist = entity.artist,
                    artworkUrl = entity.artworkUrl,
                )
            }
        }

        return ResponseEntity.ok(recentSongs)
    }

    @GetMapping("/{id}")
    fun getSongById(@PathVariable id: Long): ResponseEntity<SongDto> {
        val response = try {
            songDetailQueryService.metadata(id)
        } catch (e: com.japanese.vocabulary.common.exception.BusinessException) {
            return ResponseEntity.status(e.errorCode.status).build()
        }
        recentSongService.recordListen(currentUserId(), id)
        return ResponseEntity.ok(response)
    }

    @GetMapping("/{id}/lyrics")
    fun getSongLyrics(@PathVariable id: Long): ResponseEntity<SongLyricsDto> {
        val response = try {
            songDetailQueryService.lyrics(id)
        } catch (e: com.japanese.vocabulary.common.exception.BusinessException) {
            return ResponseEntity.status(e.errorCode.status).build()
        }
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(response)
    }

    @GetMapping("/{id}/words")
    fun getSongWords(@PathVariable id: Long): ResponseEntity<WordsInSongDto> {
        val response = try {
            songDetailQueryService.words(id, currentUserId())
        } catch (e: com.japanese.vocabulary.common.exception.BusinessException) {
            return ResponseEntity.status(e.errorCode.status).build()
        }
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(response)
    }

    /**
     * 미리보기 카드(홈 콜드스타트의 추천곡 단어, 곡 상세에서 고른 아직 안 담긴 단어)에 rating 을
     * 주면 그 곡을 통째로 담고 그 단어를 곧바로 리뷰한다. 응답에 남은 due 카드까지 담아
     * 클라이언트가 별도 조회 없이 바로 이어서 복습하게 한다.
     */
    @PostMapping("/{id}/study-bootstrap")
    fun studyBootstrap(
        @PathVariable id: Long,
        @RequestBody request: SongStudyBootstrapRequest,
    ): SongStudyBootstrapResponse =
        songStudyBootstrapService.bootstrap(currentUserId(), id, request.rating, request.leadJapanese)

    @GetMapping("/search")
    fun searchSongs(@RequestParam q: String): ResponseEntity<SongSearchResponse> {
        searchHistoryService.record(currentUserId(), q)
        return ResponseEntity.ok(songSearchService.search(q))
    }

    private fun AnalyzedSongDto.toResponse() = SongStudyDto(
        song = song,
        studyUnits = studyUnits,
        youtubeUrl = youtubeUrl,
        lyricsSourceName = lyricsSourceName,
        lyricsSourceUrl = lyricsSourceUrl,
    )

    private fun SongAnalysisWorkDto.toResponse() = SongAnalysisWorkResponse(
        workId = workId,
        status = status.name,
        currentStage = currentStage,
        songId = songId,
        lyricId = lyricId,
        youtubeUrl = youtubeUrl,
        canOpenPlayer = canOpenPlayer,
        isAnalysisComplete = isAnalysisComplete,
        errorCode = errorCode,
        errorMessage = errorMessage,
    )
}
