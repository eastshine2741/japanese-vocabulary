package com.japanese.vocabulary.common.exception

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.http.HttpStatus
import org.springframework.web.multipart.MultipartException

class GlobalExceptionHandlerTest {

    private val handler = GlobalExceptionHandler()

    @Test
    fun `multipart parsing failures return bad request error response`() {
        val response = handler.handleMultipartException(
            MultipartException("Failed to parse multipart servlet request"),
        )

        assertThat(response.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        assertThat(response.body?.error).isEqualTo("MALFORMED_MULTIPART_REQUEST")
        assertThat(response.body?.message).isEqualTo("Malformed multipart request")
    }
}
