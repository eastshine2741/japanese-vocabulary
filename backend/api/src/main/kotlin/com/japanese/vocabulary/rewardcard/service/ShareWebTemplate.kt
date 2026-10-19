package com.japanese.vocabulary.rewardcard.service

import com.japanese.vocabulary.rewardcard.config.ShareProperties
import org.slf4j.LoggerFactory
import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import java.time.Clock
import java.time.Duration
import java.time.Instant

/**
 * share-web 이 서빙하는 카드 웹 화면의 index.html. 번들 파일명이 배포마다 바뀌어 잠깐씩만 들고 있는다.
 * 못 받으면 null 이라 랜딩은 서버가 그린 페이지로 대신한다.
 */
@Component
class ShareWebTemplate(
    private val shareProperties: ShareProperties,
    private val clock: Clock,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    private val restClient = RestClient.builder()
        .requestFactory(SimpleClientHttpRequestFactory().apply {
            setConnectTimeout(Duration.ofSeconds(2))
            setReadTimeout(Duration.ofSeconds(2))
        })
        .build()

    @Volatile
    private var cached: Pair<Instant, String?>? = null

    fun indexHtml(): String? {
        val url = shareProperties.webIndexUrl
        if (url.isBlank()) return null
        val now = Instant.now(clock)
        cached?.let { (at, html) -> if (Duration.between(at, now) < TTL) return html }
        val html = try {
            restClient.get().uri(url).retrieve().body(String::class.java)?.takeIf { it.contains("</head>") }
        } catch (e: Exception) {
            log.warn("Failed to fetch share web index url={}", url, e)
            null
        }
        cached = now to html
        return html
    }

    companion object {
        private val TTL: Duration = Duration.ofMinutes(1)
    }
}
