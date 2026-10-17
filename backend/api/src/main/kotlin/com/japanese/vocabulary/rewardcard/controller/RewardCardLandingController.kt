package com.japanese.vocabulary.rewardcard.controller

import com.japanese.vocabulary.rewardcard.config.ShareProperties
import com.japanese.vocabulary.rewardcard.service.RewardCardLandingPage
import com.japanese.vocabulary.rewardcard.service.RewardCardLandingService
import org.springframework.http.CacheControl
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RestController
import java.time.Duration

/** 인증 없는 공개 경로. 링크 미리보기 크롤러는 JS 를 돌리지 않아 메타를 서버가 채운다. */
@RestController
class RewardCardLandingController(
    private val rewardCardLandingService: RewardCardLandingService,
    private val shareProperties: ShareProperties,
) {
    private val htmlType = MediaType("text", "html", Charsets.UTF_8)

    @GetMapping("/c/{token}")
    fun landing(@PathVariable token: String): ResponseEntity<String> {
        val html = rewardCardLandingService.render(token)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .contentType(htmlType)
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(1)).cachePublic())
                .body(RewardCardLandingPage.renderNotFound(shareProperties))
        return ResponseEntity.ok()
            .contentType(htmlType)
            .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
            .body(html)
    }

    // iOS 는 이 파일을 리다이렉트 없이 application/json 으로 받아야 Universal Links 를 켠다.
    @GetMapping("/.well-known/apple-app-site-association", produces = [MediaType.APPLICATION_JSON_VALUE])
    fun appleAppSiteAssociation(): ResponseEntity<Any> {
        val appId = shareProperties.appleAppId
        if (appId.isBlank()) return ResponseEntity.notFound().build()
        return ResponseEntity.ok(
            mapOf(
                "applinks" to mapOf(
                    "apps" to emptyList<String>(),
                    "details" to listOf(
                        mapOf(
                            "appIDs" to listOf(appId),
                            "components" to listOf(mapOf("/" to "/c/*")),
                            "appID" to appId,
                            "paths" to listOf("/c/*"),
                        )
                    ),
                )
            )
        )
    }

    @GetMapping("/.well-known/assetlinks.json", produces = [MediaType.APPLICATION_JSON_VALUE])
    fun assetLinks(): ResponseEntity<Any> {
        val fingerprints = shareProperties.androidSha256Fingerprints
        if (fingerprints.isEmpty() || shareProperties.androidPackage.isBlank()) return ResponseEntity.notFound().build()
        return ResponseEntity.ok(
            listOf(
                mapOf(
                    "relation" to listOf("delegate_permission/common.handle_all_urls"),
                    "target" to mapOf(
                        "namespace" to "android_app",
                        "package_name" to shareProperties.androidPackage,
                        "sha256_cert_fingerprints" to fingerprints,
                    ),
                )
            )
        )
    }
}
