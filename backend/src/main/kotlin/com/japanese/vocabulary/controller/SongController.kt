package com.japanese.vocabulary.controller

import com.japanese.vocabulary.client.ItunesClient
import com.japanese.vocabulary.client.LyricsNotFoundException
import com.japanese.vocabulary.model.AnalyzeSongRequest
import com.japanese.vocabulary.model.ErrorResponse
import com.japanese.vocabulary.model.SongSearchResponse
import com.japanese.vocabulary.model.SongDTO
import com.japanese.vocabulary.service.LyricProcessingService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/songs")
class SongController(
    private val lyricProcessingService: LyricProcessingService,
    private val itunesClient: ItunesClient
) {

    @PostMapping("/analyze")
    fun analyzeSong(@RequestBody request: AnalyzeSongRequest): ResponseEntity<SongDTO> {
        val result = lyricProcessingService.analyze(
            title = request.title,
            artist = request.artist,
            durationSeconds = request.durationSeconds
        )
        return ResponseEntity.ok(result)
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
