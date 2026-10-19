package com.japanese.vocabulary.admin.controller

import com.japanese.vocabulary.admin.dto.AdminSongReportApproveRequest
import com.japanese.vocabulary.admin.dto.AdminSongReportDetailResponse
import com.japanese.vocabulary.admin.dto.AdminSongReportRejectRequest
import com.japanese.vocabulary.admin.dto.AdminSongReportSummaryResponse
import com.japanese.vocabulary.admin.service.AdminSongReportService
import com.japanese.vocabulary.song.entity.SongReportStatus
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/admin/api/song-reports")
class AdminSongReportController(
    private val adminSongReportService: AdminSongReportService,
) {
    @GetMapping
    fun list(
        @RequestParam(required = false) status: SongReportStatus?,
        pageable: Pageable,
    ): Page<AdminSongReportSummaryResponse> = adminSongReportService.list(status, pageable)

    @GetMapping("/{id}")
    fun get(@PathVariable id: Long): AdminSongReportDetailResponse = adminSongReportService.get(id)

    @PostMapping("/{id}/approve")
    fun approve(
        @PathVariable id: Long,
        @RequestBody request: AdminSongReportApproveRequest,
    ): AdminSongReportDetailResponse = adminSongReportService.approve(id, request)

    @PostMapping("/{id}/reject")
    fun reject(
        @PathVariable id: Long,
        @RequestBody(required = false) request: AdminSongReportRejectRequest?,
    ): AdminSongReportDetailResponse = adminSongReportService.reject(id, request ?: AdminSongReportRejectRequest())
}
