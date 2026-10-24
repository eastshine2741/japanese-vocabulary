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
 * Adds an `api` tag to `http.client.requests` by classifying (host, path). Match is strict:
 * broad suffixes like `*.apple.com` or `*.googleapis.com` would over-match. Unknown
 * destinations get `other`. `api_group` rolls those up so a dashboard panel survives a new provider.
 *
 * Two beans because RestClient and WebClient use separate convention types.
 */
@Configuration
class HttpClientMetricsConfig {
    @Bean
    fun restClientObservationConvention(): RestClientConv = object : RestClientConv() {
        override fun getLowCardinalityKeyValues(context: RestClientCtx): KeyValues =
            super.getLowCardinalityKeyValues(context)
                .and(apiKeyValues(classify(context.carrier?.uri)))
    }

    @Bean
    fun webClientObservationConvention(): WebClientConv = object : WebClientConv() {
        override fun getLowCardinalityKeyValues(context: WebClientCtx): KeyValues =
            super.getLowCardinalityKeyValues(context)
                .and(apiKeyValues(classify(context.carrier?.build()?.url())))
    }

    companion object {
        private fun apiKeyValues(api: String): KeyValues = KeyValues.of("api", api, "api_group", groupOf(api))

        fun classify(uri: URI?): String {
            val host = uri?.host ?: return "other"
            val path = uri.path.orEmpty()
            return when {
                host == "api.music.apple.com" -> "apple-music"
                host == "www.googleapis.com" && path.startsWith("/youtube/") -> "youtube"
                host == "generativelanguage.googleapis.com" -> "gemini"
                host == "api.typesafe.ai" -> "jev"
                host == "lrclib.net" -> "lrclib"
                host == "vocadb.net" -> "vocadb"
                host == "utaitedb.net" -> "utaitedb"
                host == "api.github.com" -> "github"
                else -> "other"
            }
        }

        fun groupOf(api: String): String = when (api) {
            "gemini", "jev" -> "llm"
            "lrclib" -> "lyrics"
            "apple-music", "vocadb", "utaitedb" -> "music-meta"
            "youtube" -> "video"
            "github" -> "ops"
            else -> "other"
        }
    }
}
