package com.japanese.vocabulary.karaoke.controller

import com.japanese.vocabulary.karaoke.dto.KaraokeDailyGroupResponse
import com.japanese.vocabulary.karaoke.dto.KaraokeMonthlyResponse
import com.japanese.vocabulary.karaoke.dto.toResponse
import com.japanese.vocabulary.karaoke.service.KaraokeSongService
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.YearMonth

/** 노래방 일본 신곡. 원장은 노래방별 행이고 합치기는 응답에서만 한다 (docs/karaoke-new-songs.md). */
@RestController
@RequestMapping("/api/karaoke-songs")
class KaraokeSongController(
    private val karaokeSongService: KaraokeSongService,
) {
    @GetMapping("/daily")
    fun daily(
        @RequestParam @DateTimeFormat(pattern = "yyyy-MM") month: YearMonth,
    ): ResponseEntity<List<KaraokeDailyGroupResponse>> =
        ResponseEntity.ok(karaokeSongService.daily(month).map { it.toResponse() })

    @GetMapping("/monthly")
    fun monthly(
        @RequestParam @DateTimeFormat(pattern = "yyyy-MM") month: YearMonth,
    ): ResponseEntity<KaraokeMonthlyResponse> =
        ResponseEntity.ok(karaokeSongService.monthly(month).toResponse())
}
