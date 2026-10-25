package com.japanese.vocabulary.admin.controller

import com.japanese.vocabulary.admin.dto.AdminArtistChannel
import com.japanese.vocabulary.admin.dto.AdminArtistChannelAddRequest
import com.japanese.vocabulary.admin.dto.AdminArtistDetail
import com.japanese.vocabulary.admin.dto.AdminArtistSummary
import com.japanese.vocabulary.common.exception.BusinessException
import com.japanese.vocabulary.common.exception.ErrorCode
import com.japanese.vocabulary.song.entity.ArtistEntity
import com.japanese.vocabulary.song.entity.ArtistYoutubeChannelEntity
import com.japanese.vocabulary.song.repository.ArtistRepository
import com.japanese.vocabulary.song.service.ArtistYoutubeChannelService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/admin/api/artists")
class AdminArtistController(
    private val artistRepository: ArtistRepository,
    private val channelService: ArtistYoutubeChannelService,
) {
    @GetMapping
    fun search(@RequestParam(defaultValue = "") query: String): List<AdminArtistSummary> =
        artistRepository.findTop50ByNameContainingOrderByNameAsc(query.trim()).map { it.toSummary() }

    @GetMapping("/{id}")
    fun detail(@PathVariable id: Long): AdminArtistDetail {
        val artist = artistRepository.findById(id).orElseThrow { BusinessException(ErrorCode.ARTIST_NOT_FOUND) }
        return AdminArtistDetail(
            artist = artist.toSummary(),
            appleMusicUrl = artist.appleMusicUrl,
            youtubeChannels = channelService.list(id).map { it.toResponse() },
        )
    }

    @PostMapping("/{id}/youtube-channels")
    fun addChannel(@PathVariable id: Long, @RequestBody request: AdminArtistChannelAddRequest): ResponseEntity<AdminArtistChannel> =
        ResponseEntity.status(HttpStatus.CREATED).body(channelService.add(id, request.channel, request.channelTitle).toResponse())

    @DeleteMapping("/{id}/youtube-channels/{channelId}")
    fun removeChannel(@PathVariable id: Long, @PathVariable channelId: String): ResponseEntity<Void> {
        channelService.remove(id, channelId)
        return ResponseEntity.noContent().build()
    }
}

private fun ArtistEntity.toSummary() = AdminArtistSummary(id = requireNotNull(id), name = name, artworkUrl = artworkUrl)

private fun ArtistYoutubeChannelEntity.toResponse() =
    AdminArtistChannel(channelId = channelId, channelTitle = channelTitle, createdAt = createdAt)
