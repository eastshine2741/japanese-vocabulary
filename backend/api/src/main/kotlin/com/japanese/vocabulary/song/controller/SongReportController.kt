package com.japanese.vocabulary.song.controller

import com.japanese.vocabulary.song.dto.report.SongContributorsDto
import com.japanese.vocabulary.song.dto.report.SongReportTypeDto
import com.japanese.vocabulary.song.dto.report.SubmitSongReportRequest
import com.japanese.vocabulary.song.dto.report.SubmitSongReportResponse
import com.japanese.vocabulary.song.model.SongReportTarget
import com.japanese.vocabulary.song.model.SongReportType
import com.japanese.vocabulary.song.service.SongContributorService
import com.japanese.vocabulary.song.service.SongReportService
import org.springframework.http.HttpStatus
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api")
class SongReportController(
    private val songReportService: SongReportService,
    private val songContributorService: SongContributorService,
) {
    @GetMapping("/song-reports/types")
    fun types(): List<SongReportTypeDto> = SongReportType.entries.map(SongReportTypeDto::from)

    @PostMapping("/songs/{songId}/reports")
    @ResponseStatus(HttpStatus.CREATED)
    fun submit(@PathVariable songId: Long, @RequestBody request: SubmitSongReportRequest): SubmitSongReportResponse {
        val userId = SecurityContextHolder.getContext().authentication.principal as Long
        val target = request.target?.let { SongReportTarget(lineIndex = it.lineIndex, charStart = it.charStart, charEnd = it.charEnd) }
        val report = songReportService.submit(userId, songId, SongReportType.of(request.type), target, request.suggestion)
        return SubmitSongReportResponse(id = report.id!!, status = report.status.name)
    }

    @GetMapping("/songs/{songId}/contributors")
    fun contributors(@PathVariable songId: Long): SongContributorsDto = songContributorService.contributors(songId)
}
