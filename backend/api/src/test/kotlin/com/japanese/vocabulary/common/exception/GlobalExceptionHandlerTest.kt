package com.japanese.vocabulary.common.exception

import com.japanese.vocabulary.test.ApiBaseIntegrationTest
import jakarta.servlet.http.HttpServletRequest
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.post
import org.springframework.web.multipart.MultipartException
import org.springframework.web.multipart.MultipartHttpServletRequest
import org.springframework.web.multipart.MultipartResolver

@AutoConfigureMockMvc
@Import(GlobalExceptionHandlerTest.MalformedMultipartConfig::class)
class GlobalExceptionHandlerTest : ApiBaseIntegrationTest() {

    @Autowired private lateinit var mockMvc: MockMvc

    @Test
    fun `malformed multipart request returns 400 error response`() {
        mockMvc.post("/api/auth/google") {
            contentType = MediaType.parseMediaType("multipart/form-data; boundary=truncated")
            content = "--truncated\r\nContent-Disposition: form-data; name=\"idToken\"\r\n\r\nbad"
        }.andExpect {
            status { isBadRequest() }
            jsonPath("$.error") { value(ErrorCode.INVALID_MULTIPART_REQUEST.name) }
            jsonPath("$.message") { value(ErrorCode.INVALID_MULTIPART_REQUEST.message) }
        }
    }

    @TestConfiguration
    class MalformedMultipartConfig {
        @Bean
        fun multipartResolver(): MultipartResolver = object : MultipartResolver {
            override fun isMultipart(request: HttpServletRequest): Boolean {
                return request.contentType?.startsWith(MediaType.MULTIPART_FORM_DATA_VALUE) == true
            }

            override fun resolveMultipart(request: HttpServletRequest): MultipartHttpServletRequest {
                throw MultipartException("Failed to parse multipart servlet request")
            }

            override fun cleanupMultipart(request: MultipartHttpServletRequest) = Unit
        }
    }
}
