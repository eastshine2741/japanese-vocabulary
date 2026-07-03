package com.japanese.vocabulary.admin.controller

import com.japanese.vocabulary.admin.dto.AdminLyricDetailResponse
import com.japanese.vocabulary.admin.dto.AdminSongDetailResponse
import com.japanese.vocabulary.admin.dto.AdminSongSummaryResponse
import com.japanese.vocabulary.admin.service.AdminReadService
import com.japanese.vocabulary.admin.service.AdminSongReanalysisService
import com.japanese.vocabulary.songanalysis.dto.SongAnalysisWorkDto
import com.japanese.vocabulary.admin.dto.AdminSongAnalysisWorkOperationResponse
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/admin/api/songs")
class AdminSongController(
    private val adminReadService: AdminReadService,
    private val adminSongReanalysisService: AdminSongReanalysisService,
) {
    @GetMapping
    fun listSongs(
        @RequestParam(required = false) q: String?,
        pageable: Pageable,
    ): Page<AdminSongSummaryResponse> = adminReadService.listSongs(q, pageable)

    @GetMapping("/{songId}")
    fun getSong(@PathVariable songId: Long): AdminSongDetailResponse = adminReadService.getSong(songId)

    @GetMapping("/{songId}/lyric")
    fun getSongLyric(@PathVariable songId: Long): AdminLyricDetailResponse = adminReadService.getSongLyric(songId)

    @PostMapping("/{songId}/reanalysis")
    fun triggerReanalysis(@PathVariable songId: Long): AdminSongAnalysisWorkOperationResponse =
        adminSongReanalysisService.createOrReuse(songId).toResponse()

    private fun SongAnalysisWorkDto.toResponse() = AdminSongAnalysisWorkOperationResponse(
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
