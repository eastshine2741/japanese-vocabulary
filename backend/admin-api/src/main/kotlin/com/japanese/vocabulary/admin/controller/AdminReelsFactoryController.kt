package com.japanese.vocabulary.admin.controller

import com.japanese.vocabulary.admin.dto.reels.AdminReelsRenderJobResponse
import com.japanese.vocabulary.admin.dto.reels.AdminReelsRenderRequest
import com.japanese.vocabulary.admin.dto.reels.AdminReelsSongCandidateResponse
import com.japanese.vocabulary.admin.dto.reels.AdminReelsSongDetailResponse
import com.japanese.vocabulary.admin.dto.reels.AdminReelsSourceResponse
import com.japanese.vocabulary.admin.reels.AdminReelsFactoryService
import org.springframework.core.io.FileSystemResource
import org.springframework.core.io.Resource
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RequestPart
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile

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

    /** 어드민이 직접 받은 MV mp4 를 올린다. 에디터가 스크럽할 스트리밍 경로를 돌려주고 본 렌더도 이 파일을 쓴다. */
    @PostMapping("/songs/{songId}/source", consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    fun uploadSource(
        @PathVariable songId: Long,
        @RequestPart file: MultipartFile,
    ): AdminReelsSourceResponse = service.uploadSource(songId, file)

    /** 이전에 올린 MV 가 아직 캐시에 있으면 다시 올리지 않고 쓸 수 있게 경로만 돌려준다. */
    @GetMapping("/songs/{songId}/source")
    fun cachedSource(@PathVariable songId: Long): ResponseEntity<AdminReelsSourceResponse> =
        service.cachedSource(songId)?.let { ResponseEntity.ok(it) } ?: ResponseEntity.notFound().build()

    /**
     * 에디터 `<video>` 와 Remotion Player 가 읽는 MV 스트림. 인증은 query 의 미디어 토큰으로 하고(SecurityConfig 에서 permitAll),
     * Range 요청은 Spring 이 Resource 응답을 206 으로 잘라 준다.
     */
    @GetMapping("/songs/{songId}/mv")
    fun previewSource(
        @PathVariable songId: Long,
        @RequestParam token: String,
    ): ResponseEntity<Resource> {
        val source = service.previewSource(songId, token)
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType("video/mp4"))
            .header(HttpHeaders.ACCEPT_RANGES, "bytes")
            .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
            .body(FileSystemResource(source))
    }

    /** 렌더를 줄에 세우고 바로 돌려준다. 진행과 결과는 `/render-jobs` 로 본다 — 브라우저를 닫아도 렌더는 계속된다. */
    @PostMapping("/render")
    fun render(@RequestBody request: AdminReelsRenderRequest): ResponseEntity<AdminReelsRenderJobResponse> =
        ResponseEntity.status(HttpStatus.ACCEPTED).body(service.render(request))

    @GetMapping("/render-jobs")
    fun renderJobs(): List<AdminReelsRenderJobResponse> = service.renderJobs()

    /** 끝난 렌더의 mp4. 받아도 지우지 않아 보관 시간 안에는 다시 받을 수 있다. */
    @GetMapping("/render-jobs/{jobId}/output")
    fun renderOutput(@PathVariable jobId: String): ResponseEntity<Resource> =
        ResponseEntity.ok()
            .contentType(MediaType.parseMediaType("video/mp4"))
            .body(FileSystemResource(service.renderOutput(jobId)))
}
