package com.japanese.vocabulary.test

import com.google.firebase.messaging.FirebaseMessaging
import com.ninjasquad.springmockk.MockkBean

/** batch 의 외부 의존 중 DI 를 채우려고 공통으로 잡는 건 FCM 목뿐이다. */
abstract class BatchBaseIntegrationTest : BaseIntegrationTest() {

    /**
     * Satisfies `PushNotificationService`'s DI: `FirebaseConfig` is gated on
     * `push.firebase.enabled=true` and not loaded in tests. Kept strict so an unexpected `send()` fails loudly.
     */
    @MockkBean
    protected lateinit var firebaseMessaging: FirebaseMessaging
}
