package com.japanese.vocabulary.artist.controller

import com.japanese.vocabulary.artist.dto.ArtistDetailDto
import com.japanese.vocabulary.artist.service.ArtistDetailService
import org.springframework.http.ResponseEntity
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/artists")
class ArtistController(
    private val artistDetailService: ArtistDetailService,
) {
    private fun currentUserId(): Long =
        SecurityContextHolder.getContext().authentication.principal as Long

    @GetMapping("/{id}")
    fun detail(@PathVariable id: Long): ResponseEntity<ArtistDetailDto> =
        ResponseEntity.ok().header("Cache-Control", "no-store").body(artistDetailService.detail(id, currentUserId()))
}
