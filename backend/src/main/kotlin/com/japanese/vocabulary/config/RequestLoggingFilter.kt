package com.japanese.vocabulary.config

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.LoggerFactory
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import org.springframework.web.util.ContentCachingRequestWrapper
import org.springframework.web.util.ContentCachingResponseWrapper

@Component
class RequestLoggingFilter : OncePerRequestFilter() {

    private val log = LoggerFactory.getLogger(RequestLoggingFilter::class.java)

    override fun shouldNotFilter(request: HttpServletRequest): Boolean {
        return !request.requestURI.startsWith("/api/")
    }

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain
    ) {
        val cachedRequest = ContentCachingRequestWrapper(request)
        val cachedResponse = ContentCachingResponseWrapper(response)
        val startTime = System.currentTimeMillis()

        try {
            filterChain.doFilter(cachedRequest, cachedResponse)
        } finally {
            val duration = System.currentTimeMillis() - startTime
            val method = cachedRequest.method
            val uri = cachedRequest.requestURI
            val userId = SecurityContextHolder.getContext().authentication?.principal ?: "-"
            val requestBody = cachedRequest.contentAsByteArray
                .toString(Charsets.UTF_8).ifEmpty { null }
            val responseBody = cachedResponse.contentAsByteArray
                .toString(Charsets.UTF_8).ifEmpty { null }
            val status = cachedResponse.status

            val requestLog = buildString {
                append("--> $method $uri (userId=$userId)")
                if (requestBody != null) append(" body=$requestBody")
            }
            log.info(requestLog)

            val responseLog = buildString {
                append("<-- $status $method $uri (${duration}ms)")
                if (responseBody != null) append(" body=$responseBody")
            }
            if (status >= 400) {
                log.error(responseLog)
            } else {
                log.info(responseLog)
            }

            cachedResponse.copyBodyToResponse()
        }
    }
}
