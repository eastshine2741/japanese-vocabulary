package com.japanese.vocabulary.song.controller

import com.japanese.vocabulary.song.client.itunes.ItunesClient
import com.japanese.vocabulary.song.dto.*
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.song.service.LyricProcessingService
import com.japanese.vocabulary.song.service.RecentSongService
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

    @GetMapping("/search")
    fun searchSongs(@RequestParam q: String): ResponseEntity<SongSearchResponse> {
        val result = itunesClient.search(q)
        return ResponseEntity.ok(result)
    }

}
