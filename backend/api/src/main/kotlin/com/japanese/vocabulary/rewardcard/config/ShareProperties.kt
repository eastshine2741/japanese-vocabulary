package com.japanese.vocabulary.rewardcard.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

/** 공유 링크·랜딩·앱 링크 검증 파일 설정. dev 는 `/<ns>` 접두어까지 [publicBaseUrl] 에 넣는다. */
@Component
class ShareProperties(
    @Value("\${share.public-base-url}") publicBaseUrl: String,
    @Value("\${share.app-scheme}") val appScheme: String,
    @Value("\${share.ios-app-store-url}") val iosAppStoreUrl: String,
    @Value("\${share.android-play-url}") val androidPlayUrl: String,
    @Value("\${share.apple-app-id:}") val appleAppId: String,
    @Value("\${share.android-package}") val androidPackage: String,
    @Value("\${share.android-sha256-fingerprints:}") androidSha256Fingerprints: String,
    /** `kid:secret` 를 쉼표로 잇는다. 첫 키로 서명하고 나머지는 이미 올라간 링크를 검증하려고 남긴다. */
    @Value("\${share.token-keys}") tokenKeys: String,
    /** 카드 웹 화면 빌드의 index.html. 비거나 못 받으면 서버가 그린 간단한 페이지로 대신한다. */
    @Value("\${share.web-index-url:}") val webIndexUrl: String,
) {
    val publicBaseUrl: String = publicBaseUrl.trimEnd('/')

    val androidSha256Fingerprints: List<String> =
        androidSha256Fingerprints.split(',').map { it.trim() }.filter { it.isNotEmpty() }

    val tokenKeys: List<Pair<String, String>> = tokenKeys.split(',')
        .map { it.trim() }
        .filter { it.isNotEmpty() }
        .map { entry ->
            val kid = entry.substringBefore(':', "")
            val secret = entry.substringAfter(':', "")
            require(kid.isNotEmpty() && secret.isNotEmpty()) { "share.token-keys entries must be kid:secret" }
            kid to secret
        }
        .also { require(it.isNotEmpty()) { "share.token-keys is empty" } }

    fun shareUrl(token: String) = "$publicBaseUrl/c/$token"

    fun appUrl(token: String) = "$appScheme://c/$token"
}
