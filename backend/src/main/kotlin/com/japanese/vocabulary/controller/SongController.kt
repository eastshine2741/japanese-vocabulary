package com.japanese.vocabulary.controller

import com.japanese.vocabulary.model.SongStudyData
import com.japanese.vocabulary.service.LyricProcessingService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

data class AnalyzeSongRequest(
    val title: String,
    val artist: String,
    val lyrics: String
)

@RestController
@RequestMapping("/api/songs")
class SongController(private val lyricProcessingService: LyricProcessingService) {

    @PostMapping("/analyze")
    fun analyzeSong(@RequestBody request: AnalyzeSongRequest): ResponseEntity<SongStudyData> {
        val result = lyricProcessingService.analyze(
            title = request.title,
            artist = request.artist,
            lyrics = request.lyrics
        )
        return ResponseEntity.ok(result)
    }
}
