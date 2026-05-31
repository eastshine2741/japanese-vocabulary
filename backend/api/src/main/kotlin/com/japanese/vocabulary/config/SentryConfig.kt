package com.japanese.vocabulary.config

import io.sentry.SentryEvent
import io.sentry.SentryOptions
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class SentryConfig {

    @Bean
    fun sentryOptionsCustomizer() = SentryOptions.BeforeSendCallback { event: SentryEvent, _ ->
        val url = event.request?.url ?: return@BeforeSendCallback event
        if (url.contains("/actuator") || url.endsWith("/health")) null else event
    }
}
