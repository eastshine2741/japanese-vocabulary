package com.japanese.vocabulary.controller

import com.japanese.vocabulary.client.LyricsNotFoundException
import com.japanese.vocabulary.client.YoutubeClient
import com.japanese.vocabulary.model.AnalyzeSongRequest
import com.japanese.vocabulary.model.ErrorResponse
import com.japanese.vocabulary.model.SongSearchResponse
import com.japanese.vocabulary.model.SongStudyData
import com.japanese.vocabulary.service.LyricProcessingService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/songs")
class SongController(
    private val lyricProcessingService: LyricProcessingService,
    private val youtubeClient: YoutubeClient
) {

    @PostMapping("/analyze")
    fun analyzeSong(@RequestBody request: AnalyzeSongRequest): ResponseEntity<SongStudyData> {
        val result = lyricProcessingService.analyze(
            title = request.title,
            artist = request.artist,
            durationSeconds = request.durationSeconds
        )
        return ResponseEntity.ok(result)
    }

    @GetMapping("/search")
    fun searchSongs(
        @RequestParam q: String,
        @RequestParam(required = false) pageToken: String?,
        @RequestParam(defaultValue = "10") maxResults: Int
    ): ResponseEntity<SongSearchResponse> {
        val result = youtubeClient.search(q, pageToken, maxResults)
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
