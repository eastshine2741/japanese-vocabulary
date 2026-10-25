package com.japanese.vocabulary.admin.controller

import com.japanese.vocabulary.admin.dto.AdminLyricMvSyncDetailResponse
import com.japanese.vocabulary.admin.dto.AdminLyricMvSyncSummaryResponse
import com.japanese.vocabulary.admin.service.AdminLyricMvSyncReadService
import com.japanese.vocabulary.song.entity.LyricMvSyncStatus
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/** 실행기 결과를 MV 와 맞춰 들어 보는 화면용. 실행기 경로(`/lyric-sync-agent`)와 달리 admin 토큰으로 연다. */
@RestController
@RequestMapping("/admin/api/lyric-mv-syncs")
class AdminLyricMvSyncController(
    private val readService: AdminLyricMvSyncReadService,
) {
    @GetMapping
    fun list(
        @RequestParam(required = false) status: LyricMvSyncStatus?,
        @RequestParam(required = false) verdict: String?,
        pageable: Pageable,
    ): Page<AdminLyricMvSyncSummaryResponse> = readService.list(status, verdict, pageable)

    @GetMapping("/{id}")
    fun get(@PathVariable id: Long): AdminLyricMvSyncDetailResponse = readService.get(id)
}
