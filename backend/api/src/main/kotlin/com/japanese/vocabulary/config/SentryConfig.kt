package com.japanese.vocabulary.config

import com.japanese.vocabulary.common.exception.BusinessException
import io.sentry.SentryEvent
import io.sentry.SentryOptions
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.ErrorResponse
import org.springframework.web.server.ResponseStatusException

@Configuration
class SentryConfig {

    @Bean
    fun sentryOptionsCustomizer() = SentryOptions.BeforeSendCallback { event: SentryEvent, _ ->
        val url = event.request?.url
        if (url != null && (url.contains("/actuator") || url.endsWith("/health"))) {
            return@BeforeSendCallback null
        }

        if (event.throwable?.let(::is4xx) == true) {
            return@BeforeSendCallback null
        }

        event
    }

    private fun is4xx(throwable: Throwable): Boolean = when (throwable) {
        is BusinessException -> throwable.errorCode.status.is4xxClientError
        is ResponseStatusException -> throwable.statusCode.is4xxClientError
        is ErrorResponse -> throwable.statusCode.is4xxClientError
        else -> false
    }
}
