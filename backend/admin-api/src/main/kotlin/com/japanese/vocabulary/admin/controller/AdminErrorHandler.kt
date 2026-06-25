package com.japanese.vocabulary.admin.controller

import com.japanese.vocabulary.admin.reels.AdminReelsExtractionException
import com.japanese.vocabulary.admin.reels.AdminReelsRenderBusyException
import com.japanese.vocabulary.admin.reels.AdminReelsRenderFailedException
import com.japanese.vocabulary.admin.reels.AdminReelsRenderTimeoutException
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class AdminErrorHandler {
    @ExceptionHandler(NoSuchElementException::class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    fun notFound(): Map<String, String> = mapOf("error" to "not_found")

    @ExceptionHandler(IllegalArgumentException::class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    fun badRequest(exception: IllegalArgumentException): Map<String, String> =
        mapOf("error" to "bad_request", "message" to (exception.message ?: "bad request"))

    @ExceptionHandler(AdminReelsRenderBusyException::class)
    @ResponseStatus(HttpStatus.CONFLICT)
    fun renderBusy(): Map<String, String> = mapOf("error" to "render_busy")

    @ExceptionHandler(AdminReelsExtractionException::class)
    @ResponseStatus(HttpStatus.BAD_GATEWAY)
    fun extractionFailed(exception: AdminReelsExtractionException): Map<String, String> =
        mapOf("error" to "extraction_failed", "message" to (exception.message ?: "extraction failed"))

    @ExceptionHandler(AdminReelsRenderTimeoutException::class)
    @ResponseStatus(HttpStatus.GATEWAY_TIMEOUT)
    fun renderTimeout(): Map<String, String> = mapOf("error" to "render_timeout")

    @ExceptionHandler(AdminReelsRenderFailedException::class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    fun renderFailed(): Map<String, String> =
        mapOf("error" to "render_failed", "message" to "Renderer failed")
}
