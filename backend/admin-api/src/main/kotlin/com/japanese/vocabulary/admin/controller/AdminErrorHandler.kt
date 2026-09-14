package com.japanese.vocabulary.admin.controller

import com.japanese.vocabulary.admin.reels.AdminReelsMediaTokenException
import com.japanese.vocabulary.admin.reels.AdminReelsPreviewTranscodeException
import com.japanese.vocabulary.admin.reels.AdminReelsRenderBusyException
import com.japanese.vocabulary.admin.reels.AdminReelsRenderFailedException
import com.japanese.vocabulary.admin.reels.AdminReelsRenderTimeoutException
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.multipart.MaxUploadSizeExceededException

@RestControllerAdvice
class AdminErrorHandler {
    @ExceptionHandler(NoSuchElementException::class)
    fun notFound(): ResponseEntity<Map<String, String>> =
        json(HttpStatus.NOT_FOUND, mapOf("error" to "not_found"))

    @ExceptionHandler(IllegalArgumentException::class)
    fun badRequest(exception: IllegalArgumentException): ResponseEntity<Map<String, String>> =
        json(HttpStatus.BAD_REQUEST, mapOf("error" to "bad_request", "message" to (exception.message ?: "bad request")))

    @ExceptionHandler(AdminReelsMediaTokenException::class)
    fun mediaTokenRejected(): ResponseEntity<Map<String, String>> =
        json(HttpStatus.UNAUTHORIZED, mapOf("error" to "unauthorized"))

    @ExceptionHandler(AdminReelsRenderBusyException::class)
    fun renderBusy(): ResponseEntity<Map<String, String>> =
        json(HttpStatus.CONFLICT, mapOf("error" to "render_busy"))

    @ExceptionHandler(MaxUploadSizeExceededException::class)
    fun uploadTooLarge(): ResponseEntity<Map<String, String>> =
        json(HttpStatus.PAYLOAD_TOO_LARGE, mapOf("error" to "payload_too_large", "message" to "Uploaded file is too large"))

    @ExceptionHandler(AdminReelsRenderTimeoutException::class)
    fun renderTimeout(): ResponseEntity<Map<String, String>> =
        json(HttpStatus.GATEWAY_TIMEOUT, mapOf("error" to "render_timeout"))

    /** ffmpeg 이 못 읽는 mp4 거나 재인코딩이 시간 안에 안 끝남. 어드민이 다른 파일로 다시 올리게 한다. */
    @ExceptionHandler(AdminReelsPreviewTranscodeException::class)
    fun previewTranscodeFailed(exception: AdminReelsPreviewTranscodeException): ResponseEntity<Map<String, String>> =
        json(HttpStatus.UNPROCESSABLE_ENTITY, mapOf("error" to "source_transcode_failed", "message" to (exception.message ?: "Preview transcode failed")))

    @ExceptionHandler(AdminReelsRenderFailedException::class)
    fun renderFailed(): ResponseEntity<Map<String, String>> =
        json(HttpStatus.INTERNAL_SERVER_ERROR, mapOf("error" to "render_failed", "message" to "Renderer failed"))

    private fun json(status: HttpStatus, body: Map<String, String>): ResponseEntity<Map<String, String>> =
        ResponseEntity.status(status)
            .contentType(MediaType.APPLICATION_JSON)
            .body(body)
}
