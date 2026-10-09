package com.japanese.vocabulary.admin.controller

import com.japanese.vocabulary.admin.dto.AdminSongAnalysisWorkDetailResponse
import com.japanese.vocabulary.admin.dto.AdminSongAnalysisWorkSummaryResponse
import com.japanese.vocabulary.admin.service.AdminReadService
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStage
import com.japanese.vocabulary.songanalysis.entity.SongAnalysisWorkStatus
import com.japanese.vocabulary.songanalysis.service.SongAnalysisWorkService
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.http.MediaType
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/admin/api/song-analysis-works")
class AdminSongAnalysisWorkController(
    private val adminReadService: AdminReadService,
    private val songAnalysisWorkService: SongAnalysisWorkService,
) {
    @GetMapping
    fun listSongAnalysisWorks(
        @RequestParam(required = false) status: SongAnalysisWorkStatus?,
        pageable: Pageable,
    ): Page<AdminSongAnalysisWorkSummaryResponse> = adminReadService.listSongAnalysisWorks(status, pageable)

    @GetMapping("/{workId}")
    fun getSongAnalysisWork(@PathVariable workId: Long): AdminSongAnalysisWorkDetailResponse =
        adminReadService.getSongAnalysisWork(workId)

    /** 단계 산출물 원문. 저장된 JSON 을 그대로 내려준다. */
    @GetMapping("/{workId}/stages/{stage}/output", produces = [MediaType.APPLICATION_JSON_VALUE])
    fun getSongAnalysisStageOutput(
        @PathVariable workId: Long,
        @PathVariable stage: SongAnalysisWorkStage,
    ): String = adminReadService.getSongAnalysisStageOutput(workId, stage)

    /** 실패한 작업을 실패한 단계부터 다시 돌린다. 앞 단계 산출물은 그대로 쓴다. */
    @PostMapping("/{workId}/resume")
    fun resumeSongAnalysisWork(@PathVariable workId: Long): AdminSongAnalysisWorkDetailResponse {
        songAnalysisWorkService.resume(workId)
        return adminReadService.getSongAnalysisWork(workId)
    }
}
