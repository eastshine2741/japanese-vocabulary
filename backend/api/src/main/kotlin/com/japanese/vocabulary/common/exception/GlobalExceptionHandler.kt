package com.japanese.vocabulary.common.exception

import com.japanese.vocabulary.common.dto.ErrorResponse
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.multipart.MultipartException

@RestControllerAdvice
class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException::class)
    fun handleBusinessException(e: BusinessException): ResponseEntity<ErrorResponse> {
        return ResponseEntity
            .status(e.errorCode.status)
            .body(ErrorResponse(error = e.errorCode.name, message = e.errorCode.message))
    }

    @ExceptionHandler(MultipartException::class)
    fun handleMultipartException(e: MultipartException): ResponseEntity<ErrorResponse> {
        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body(
                ErrorResponse(
                    error = "MALFORMED_MULTIPART_REQUEST",
                    message = "Malformed multipart request",
                ),
            )
    }
}
