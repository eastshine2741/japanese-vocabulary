package com.japanese.vocabulary.observability

import io.micrometer.common.KeyValues
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.net.URI
import org.springframework.http.client.observation.ClientRequestObservationContext as RestClientCtx
import org.springframework.http.client.observation.DefaultClientRequestObservationConvention as RestClientConv
import org.springframework.web.reactive.function.client.ClientRequestObservationContext as WebClientCtx
import org.springframework.web.reactive.function.client.DefaultClientRequestObservationConvention as WebClientConv

/**
 * Adds an `api` tag to `http.client.requests` by classifying (host, path) for
 * every outbound HTTP call. Match is strict — broad suffixes like
 * `*.apple.com` or `*.googleapis.com` would over-match (those hosts serve many
 * unrelated APIs). Unknown destinations get `other` so dashboard queries don't
 * accidentally claim coverage we don't have.
 *
 * Two beans because RestClient and WebClient have separate convention types in
 * different packages.
 */
@Configuration
class HttpClientMetricsConfig {
    @Bean
    fun restClientObservationConvention(): RestClientConv = object : RestClientConv() {
        override fun getLowCardinalityKeyValues(context: RestClientCtx): KeyValues =
            super.getLowCardinalityKeyValues(context)
                .and("api", classify(context.carrier?.uri))
    }

    @Bean
    fun webClientObservationConvention(): WebClientConv = object : WebClientConv() {
        override fun getLowCardinalityKeyValues(context: WebClientCtx): KeyValues =
            super.getLowCardinalityKeyValues(context)
                .and("api", classify(context.carrier?.build()?.url()))
    }

    private fun classify(uri: URI?): String {
        val host = uri?.host ?: return "other"
        val path = uri.path.orEmpty()
        return when {
            host == "itunes.apple.com" -> "itunes"
            host == "www.googleapis.com" && path.startsWith("/youtube/") -> "youtube"
            host == "lrclib.net" -> "lrclib"
            host == "vocadb.net" -> "vocadb"
            host == "jisho.org" -> "jisho"
            else -> "other"
        }
    }
}
