package com.japanese.vocabulary.studystats.controller

import com.japanese.vocabulary.studystats.dto.HeatmapResponse
import com.japanese.vocabulary.studystats.dto.HomeStatsResponse
import com.japanese.vocabulary.studystats.dto.ProfileStatsResponse
import com.japanese.vocabulary.studystats.service.StudyStatsService
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/study-stats")
class StudyStatsController(
    private val studyStatsService: StudyStatsService,
) {
    @GetMapping("/home")
    fun getHome(): HomeStatsResponse = studyStatsService.getHome(currentUserId())

    @GetMapping("/profile")
    fun getProfile(): ProfileStatsResponse = studyStatsService.getProfile(currentUserId())

    @GetMapping("/heatmap")
    fun getHeatmap(): HeatmapResponse = studyStatsService.getHeatmap(currentUserId())

    private fun currentUserId(): Long =
        SecurityContextHolder.getContext().authentication.principal as Long
}
