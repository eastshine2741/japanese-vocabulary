package com.japanese.vocabulary.admin.controller

import com.japanese.vocabulary.admin.dto.AdminFeatureFlagRequest
import com.japanese.vocabulary.admin.dto.AdminFeatureFlagResponse
import com.japanese.vocabulary.featureflag.dto.FeatureFlagDto
import com.japanese.vocabulary.featureflag.entity.FeatureFlagWindow
import com.japanese.vocabulary.featureflag.service.FeatureFlagService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/admin/api/feature-flags")
class AdminFeatureFlagController(
    private val featureFlagService: FeatureFlagService,
) {
    @GetMapping
    fun list(): List<AdminFeatureFlagResponse> = featureFlagService.list().map { it.toAdminResponse() }

    @PutMapping("/{key}")
    fun upsert(@PathVariable key: String, @RequestBody request: AdminFeatureFlagRequest): AdminFeatureFlagResponse =
        featureFlagService.upsert(key, FeatureFlagWindow(request.startAt, request.endAt), request.description)
            .toAdminResponse()

    @DeleteMapping("/{key}")
    fun delete(@PathVariable key: String): ResponseEntity<Void> {
        featureFlagService.delete(key)
        return ResponseEntity.noContent().build()
    }
}

private fun FeatureFlagDto.toAdminResponse() =
    AdminFeatureFlagResponse(
        key = key,
        startAt = startAt,
        endAt = endAt,
        description = description,
        on = on,
        updatedAt = updatedAt,
    )
