package com.japanese.vocabulary.controller

import com.japanese.vocabulary.client.ItunesClient
import com.japanese.vocabulary.client.LyricsNotFoundException
import com.japanese.vocabulary.model.*
import com.japanese.vocabulary.repository.SongRepository
import com.japanese.vocabulary.service.LyricProcessingService
import com.japanese.vocabulary.service.RecentSongService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/songs")
class SongController(
    private val lyricProcessingService: LyricProcessingService,
    private val itunesClient: ItunesClient,
    private val recentSongService: RecentSongService,
    private val songRepository: SongRepository
) {

    private fun currentUserId(): Long =
        SecurityContextHolder.getContext().authentication.principal as Long

    @PostMapping("/analyze")
    fun analyzeSong(@RequestBody request: AnalyzeSongRequest): ResponseEntity<SongDTO> {
        val userId = currentUserId()
        val result = lyricProcessingService.analyze(
            title = request.title,
            artist = request.artist,
            durationSeconds = request.durationSeconds,
            artworkUrl = request.artworkUrl,
            userId = userId
        )
        return ResponseEntity.ok(result)
    }

    @GetMapping("/recent")
    fun getRecentSongs(): ResponseEntity<List<RecentSongItem>> {
        val userId = currentUserId()
        val songIds = recentSongService.getRecentSongIds(userId)
        if (songIds.isEmpty()) {
            return ResponseEntity.ok(emptyList())
        }

        val songsById = songRepository.findAllById(songIds).associateBy { it.id }

        // Maintain Redis order
        val recentSongs = songIds.mapNotNull { id ->
            songsById[id]?.let { entity ->
                RecentSongItem(
                    id = entity.id!!,
                    title = entity.title,
                    artist = entity.artist,
                    artworkUrl = entity.artworkUrl
                )
            }
        }

        return ResponseEntity.ok(recentSongs)
    }

    @GetMapping("/{id}")
    fun getSongById(@PathVariable id: Long): ResponseEntity<SongDTO> {
        val userId = currentUserId()
        val entity = songRepository.findById(id).orElse(null)
            ?: return ResponseEntity.notFound().build()

        recentSongService.recordListen(userId, entity.id!!)

        val songDTO = lyricProcessingService.buildSongDTO(entity)
        return ResponseEntity.ok(songDTO)
    }

    // FIXME: iTunes가 페이지네이션을 지원하지 않아서, 제대로 된 페이지네이션을 제공하지 못하고 있다.
    @GetMapping("/search")
    fun searchSongs(
        @RequestParam q: String,
        @RequestParam(defaultValue = "0") offset: Int,
        @RequestParam(defaultValue = "50") limit: Int
    ): ResponseEntity<SongSearchResponse> {
        val result = itunesClient.search(q, offset, limit)
        return ResponseEntity.ok(result)
    }


    @ExceptionHandler(LyricsNotFoundException::class)
    fun handleLyricsNotFound(e: LyricsNotFoundException): ResponseEntity<ErrorResponse> {
        return ResponseEntity
            .status(HttpStatus.NOT_FOUND)
            .body(
                ErrorResponse(
                    error = "LYRICS_NOT_FOUND",
                    message = e.message ?: "Could not find lyrics for this song"
                )
            )
    }
}
