package com.japanese.vocabulary.song.controller

import com.japanese.vocabulary.song.dto.AnalyzeSongRequest
import com.japanese.vocabulary.song.dto.RecentSongItemDto
import com.japanese.vocabulary.song.dto.SongDto
import com.japanese.vocabulary.song.dto.AnalyzedSongDto
import com.japanese.vocabulary.song.dto.SongSearchResponse
import com.japanese.vocabulary.deck.service.DeckService
import com.japanese.vocabulary.song.repository.SongRepository
import com.japanese.vocabulary.song.service.LyricProcessingService
import com.japanese.vocabulary.song.service.RecentSongService
import com.japanese.vocabulary.song.service.SearchHistoryService
import com.japanese.vocabulary.song.service.SongSearchService
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
    private val lyricProcessingService: LyricProcessingService,
    private val songSearchService: SongSearchService,
    private val recentSongService: RecentSongService,
    private val searchHistoryService: SearchHistoryService,
    private val songRepository: SongRepository,
    private val deckService: DeckService,
) {

    private fun currentUserId(): Long =
        SecurityContextHolder.getContext().authentication.principal as Long

    @PostMapping("/analyze")
    fun analyzeSong(@RequestBody request: AnalyzeSongRequest): ResponseEntity<SongDto> {
        val analyzed = lyricProcessingService.analyze(
            title = request.title,
            artist = request.artist,
            durationSeconds = request.durationSeconds,
            artworkUrl = request.artworkUrl,
            userId = currentUserId(),
        )
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

    /**
     * The home "Spotlight" song: a random pick among recently played songs the user has NOT yet
     * saved words from (no deck). Returns full study data so the hero can play its MV + synced lyrics.
     * 204 when there is no eligible song. Does NOT record a listen (read-only surfacing).
     */
    @GetMapping("/spotlight")
    fun getSpotlight(): ResponseEntity<SongDto> {
        val userId = currentUserId()
        val deckSongIds = deckService.getDeckSongIds(userId)
        val spotlightId = recentSongService.getRecentSongIds(userId)
            .filter { it !in deckSongIds }
            .randomOrNull()
            ?: return ResponseEntity.noContent().build()

        val entity = songRepository.findById(spotlightId).orElse(null)
            ?: return ResponseEntity.noContent().build()

        val analyzed = lyricProcessingService.buildAnalyzedSong(entity)
        return ResponseEntity.ok(analyzed.toResponse())
    }

    @GetMapping("/{id}")
    fun getSongById(@PathVariable id: Long): ResponseEntity<SongDto> {
        val entity = songRepository.findById(id).orElse(null)
            ?: return ResponseEntity.notFound().build()

        recentSongService.recordListen(currentUserId(), entity.id!!)

        val analyzed = lyricProcessingService.buildAnalyzedSong(entity)
        return ResponseEntity.ok(analyzed.toResponse())
    }

    @GetMapping("/search")
    fun searchSongs(@RequestParam q: String): ResponseEntity<SongSearchResponse> {
        searchHistoryService.record(currentUserId(), q)
        return ResponseEntity.ok(songSearchService.search(q))
    }

    private fun AnalyzedSongDto.toResponse() = SongDto(
        song = song,
        studyUnits = studyUnits,
        youtubeUrl = youtubeUrl,
        lyricsSourceName = lyricsSourceName,
        lyricsSourceUrl = lyricsSourceUrl,
    )
}
