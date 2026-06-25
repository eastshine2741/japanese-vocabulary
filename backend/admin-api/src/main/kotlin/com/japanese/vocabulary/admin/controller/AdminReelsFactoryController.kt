package com.japanese.vocabulary.admin.controller

import com.japanese.vocabulary.admin.dto.reels.AdminReelsRenderRequest
import com.japanese.vocabulary.admin.dto.reels.AdminReelsSongCandidateResponse
import com.japanese.vocabulary.admin.dto.reels.AdminReelsSongDetailResponse
import com.japanese.vocabulary.admin.reels.AdminReelsFactoryService
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.http.ContentDisposition
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.nio.file.Files
import java.nio.file.Path

@RestController
@RequestMapping("/admin/api/reels-factory")
class AdminReelsFactoryController(
    private val service: AdminReelsFactoryService,
) {
    @GetMapping("/songs")
    fun listSongs(
        @RequestParam(required = false) q: String?,
        pageable: Pageable,
    ): Page<AdminReelsSongCandidateResponse> = service.listSongs(q, pageable)

    @GetMapping("/songs/{songId}")
    fun getSong(@PathVariable songId: Long): AdminReelsSongDetailResponse = service.getSong(songId)

    @PostMapping("/render")
    fun render(@RequestBody request: AdminReelsRenderRequest): ResponseEntity<StreamingResponseBody> {
        val output = service.render(request)
        val outputSize = Files.size(output)
        val responseBody = StreamingResponseBody { responseStream ->
            try {
                Files.newInputStream(output).use { inputStream ->
                    inputStream.copyTo(responseStream)
                }
            } finally {
                deleteOutputDirectory(output)
            }
        }
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType("video/mp4"))
            .contentLength(outputSize)
            .header(
                HttpHeaders.CONTENT_DISPOSITION,
                ContentDisposition.attachment().filename("kotonoha-reel-${request.songId}.mp4").build().toString(),
            )
            .body(responseBody)
    }

    private fun deleteOutputDirectory(output: Path) {
        runCatching {
            Files.walk(output.parent)
                .sorted(Comparator.reverseOrder())
                .forEach(Files::deleteIfExists)
        }
    }
}
