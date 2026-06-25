package com.japanese.vocabulary.admin.controller

import com.japanese.vocabulary.admin.dto.AdminSongAnalysisWorkDetailResponse
import com.japanese.vocabulary.admin.dto.AdminSongAnalysisWorkSummaryResponse
import com.japanese.vocabulary.admin.service.AdminReadService
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/admin/api/song-analysis-works")
class AdminSongAnalysisWorkController(
    private val adminReadService: AdminReadService,
) {
    @GetMapping
    fun listSongAnalysisWorks(
        @RequestParam(required = false) status: SongAnalysisWorkStatus?,
        pageable: Pageable,
    ): Page<AdminSongAnalysisWorkSummaryResponse> = adminReadService.listSongAnalysisWorks(status, pageable)

    @GetMapping("/{workId}")
    fun getSongAnalysisWork(@PathVariable workId: Long): AdminSongAnalysisWorkDetailResponse =
        adminReadService.getSongAnalysisWork(workId)
}
