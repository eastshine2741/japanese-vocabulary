package com.japanese.vocabulary.test

import com.google.firebase.messaging.FirebaseMessaging
import com.ninjasquad.springmockk.MockkBean

/**
 * 곡 분석 파이프라인이 `worker` 로 간 뒤로, batch 가 쓰는 외부 의존은 각 테스트가 직접 `@MockkBean`
 * 으로 잡는 apple-music-rss / itunes 정도다. 여기 남는 건 DI 를 채우기 위한 FCM 목뿐이다.
 */
abstract class BatchBaseIntegrationTest : BaseIntegrationTest() {

    /**
     * Satisfies `PushNotificationService`'s DI: `FirebaseConfig` is gated on
     * `push.firebase.enabled=true` and not loaded in tests. Kept strict so an unexpected `send()` fails loudly.
     */
    @MockkBean
    protected lateinit var firebaseMessaging: FirebaseMessaging
}
