package com.japanese.vocabulary.admin.controller

import com.japanese.vocabulary.admin.dto.AdminLyricSyncClaimResponse
import com.japanese.vocabulary.admin.dto.AdminLyricSyncCompleteRequest
import com.japanese.vocabulary.admin.dto.AdminLyricSyncFailRequest
import com.japanese.vocabulary.song.service.LyricMvSyncService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/** 로컬 PC 가사 싱크 실행기가 부르는 API. 실행기 토큰으로만 열린다(`SecurityConfig`). */
@RestController
@RequestMapping("/admin/api/lyric-sync-agent")
class AdminLyricSyncAgentController(
    private val lyricMvSyncService: LyricMvSyncService,
) {
    /** 처리할 작업 하나를 점유한다. 없으면 204. */
    @PostMapping("/claim")
    fun claim(): ResponseEntity<AdminLyricSyncClaimResponse> {
        val claim = lyricMvSyncService.claim() ?: return ResponseEntity.noContent().build()
        return ResponseEntity.ok(
            AdminLyricSyncClaimResponse(
                id = claim.id,
                attempt = claim.attempt,
                songId = claim.songId,
                title = claim.title,
                artist = claim.artist,
                durationSeconds = claim.durationSeconds,
                lyricId = claim.lyricId,
                lyricType = claim.lyricType.name,
                youtubeVideoId = claim.youtubeVideoId,
                lines = claim.lines,
            ),
        )
    }

    @PostMapping("/syncs/{id}/complete")
    fun complete(@PathVariable id: Long, @RequestBody request: AdminLyricSyncCompleteRequest): ResponseEntity<Unit> {
        lyricMvSyncService.complete(id, request.attempt, request.method, request.lines, request.confidence)
        return ResponseEntity.noContent().build()
    }

    @PostMapping("/syncs/{id}/fail")
    fun fail(@PathVariable id: Long, @RequestBody request: AdminLyricSyncFailRequest): ResponseEntity<Unit> {
        lyricMvSyncService.fail(id, request.attempt, request.message, request.retryable)
        return ResponseEntity.noContent().build()
    }
}
