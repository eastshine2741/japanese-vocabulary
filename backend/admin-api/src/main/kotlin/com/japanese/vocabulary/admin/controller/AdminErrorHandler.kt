package com.japanese.vocabulary.admin.controller

import com.japanese.vocabulary.admin.reels.AdminReelsExtractionException
import com.japanese.vocabulary.admin.reels.AdminReelsRenderBusyException
import com.japanese.vocabulary.admin.reels.AdminReelsRenderFailedException
import com.japanese.vocabulary.admin.reels.AdminReelsRenderTimeoutException
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class AdminErrorHandler {
    @ExceptionHandler(NoSuchElementException::class)
    fun notFound(): ResponseEntity<Map<String, String>> =
        json(HttpStatus.NOT_FOUND, mapOf("error" to "not_found"))

    @ExceptionHandler(IllegalArgumentException::class)
    fun badRequest(exception: IllegalArgumentException): ResponseEntity<Map<String, String>> =
        json(HttpStatus.BAD_REQUEST, mapOf("error" to "bad_request", "message" to (exception.message ?: "bad request")))

    @ExceptionHandler(AdminReelsRenderBusyException::class)
    fun renderBusy(): ResponseEntity<Map<String, String>> =
        json(HttpStatus.CONFLICT, mapOf("error" to "render_busy"))

    @ExceptionHandler(AdminReelsExtractionException::class)
    fun extractionFailed(exception: AdminReelsExtractionException): ResponseEntity<Map<String, String>> =
        json(HttpStatus.BAD_GATEWAY, mapOf("error" to "extraction_failed", "message" to (exception.message ?: "extraction failed")))

    @ExceptionHandler(AdminReelsRenderTimeoutException::class)
    fun renderTimeout(): ResponseEntity<Map<String, String>> =
        json(HttpStatus.GATEWAY_TIMEOUT, mapOf("error" to "render_timeout"))

    @ExceptionHandler(AdminReelsRenderFailedException::class)
    fun renderFailed(): ResponseEntity<Map<String, String>> =
        json(HttpStatus.INTERNAL_SERVER_ERROR, mapOf("error" to "render_failed", "message" to "Renderer failed"))

    private fun json(status: HttpStatus, body: Map<String, String>): ResponseEntity<Map<String, String>> =
        ResponseEntity.status(status)
            .contentType(MediaType.APPLICATION_JSON)
            .body(body)
}
