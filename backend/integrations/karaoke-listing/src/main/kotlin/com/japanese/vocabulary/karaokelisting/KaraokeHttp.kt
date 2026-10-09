package com.japanese.vocabulary.karaokelisting

import org.springframework.http.HttpHeaders
import org.springframework.web.client.RestClient

// 두 사이트 모두 공식 API 가 아니라 브라우저가 부르는 엔드포인트라서 브라우저 UA 로 부른다.
internal fun RestClient.Builder.asBrowser(baseUrl: String): RestClient =
    clone()
        .baseUrl(baseUrl)
        .defaultHeader(HttpHeaders.USER_AGENT, BROWSER_USER_AGENT)
        .build()

private const val BROWSER_USER_AGENT =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
