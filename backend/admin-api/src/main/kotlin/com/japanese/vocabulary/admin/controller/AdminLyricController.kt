package com.japanese.vocabulary.admin.controller

import com.japanese.vocabulary.admin.dto.AdminLyricDetailResponse
import com.japanese.vocabulary.admin.dto.AdminLyricSummaryResponse
import com.japanese.vocabulary.admin.service.AdminReadService
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/admin/api/lyrics")
class AdminLyricController(
    private val adminReadService: AdminReadService,
) {
    @GetMapping
    fun listLyrics(
        pageable: Pageable,
    ): Page<AdminLyricSummaryResponse> = adminReadService.listLyrics(pageable)

    @GetMapping("/{lyricId}")
    fun getLyric(@PathVariable lyricId: Long): AdminLyricDetailResponse = adminReadService.getLyric(lyricId)
}
