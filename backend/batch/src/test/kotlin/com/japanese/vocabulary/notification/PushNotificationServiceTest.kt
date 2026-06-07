package com.japanese.vocabulary.notification

import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingException
import com.google.firebase.messaging.Message
import com.google.firebase.messaging.MessagingErrorCode
import com.japanese.vocabulary.notification.repository.DeviceTokenRepository
import com.japanese.vocabulary.notification.entity.NotificationLogEntity
import com.japanese.vocabulary.notification.repository.NotificationLogRepository
import com.japanese.vocabulary.notification.service.PushNotificationService
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

/**
 * Pure-mock verification of [PushNotificationService]'s three branches:
 * FCM accept → log row written; UNREGISTERED → token deleted; INVALID_ARGUMENT → token kept.
 */
class PushNotificationServiceTest {

    private val firebaseMessaging: FirebaseMessaging = mockk()
    private val notificationLogRepository: NotificationLogRepository = mockk(relaxed = true)
    private val deviceTokenRepository: DeviceTokenRepository = mockk(relaxed = true)
    private val service = PushNotificationService(
        firebaseMessaging,
        notificationLogRepository,
        deviceTokenRepository,
    )

    private fun fcmError(code: MessagingErrorCode): FirebaseMessagingException {
        val e = mockk<FirebaseMessagingException>()
        every { e.messagingErrorCode } returns code
        every { e.message } returns "mocked: $code"
        every { e.cause } returns null
        every { e.stackTrace } returns emptyArray()
        every { e.suppressed } returns emptyArray()
        every { e.localizedMessage } returns "mocked: $code"
        return e
    }

    @Test
    fun `send writes notification log on FCM accept`() {
        val captured = slot<Message>()
        every { firebaseMessaging.send(capture(captured)) } returns "fcm-msg-id"
        val logSlot = slot<NotificationLogEntity>()
        every { notificationLogRepository.save(capture(logSlot)) } answers { firstArg() }

        val ok = service.send(
            userId = 7L,
            token = "tok-7",
            title = "勉強, 이 단어 기억나시나요?",
            body = "잊어버리기 전에 잠깐 들러보세요.",
            data = mapOf("type" to "review_reminder", "flashcardId" to "42"),
        )

        assertThat(ok).isTrue()
        verify(exactly = 1) { firebaseMessaging.send(any<Message>()) }
        verify(exactly = 1) { notificationLogRepository.save(any()) }
        verify(exactly = 0) { deviceTokenRepository.deleteByToken(any()) }
        assertThat(logSlot.captured.userId).isEqualTo(7L)
        assertThat(logSlot.captured.title).isEqualTo("勉強, 이 단어 기억나시나요?")
    }

    @Test
    fun `UNREGISTERED FCM error deletes token and writes no log row`() {
        every { firebaseMessaging.send(any<Message>()) } throws fcmError(MessagingErrorCode.UNREGISTERED)

        val ok = service.send(11L, "stale-token", "t", "b")

        assertThat(ok).isFalse()
        verify(exactly = 1) { deviceTokenRepository.deleteByToken("stale-token") }
        verify(exactly = 0) { notificationLogRepository.save(any()) }
    }

    @Test
    fun `INVALID_ARGUMENT FCM error keeps token and writes no log row`() {
        every { firebaseMessaging.send(any<Message>()) } throws fcmError(MessagingErrorCode.INVALID_ARGUMENT)

        val ok = service.send(13L, "still-valid-token", "t", "b")

        assertThat(ok).isFalse()
        verify(exactly = 0) { deviceTokenRepository.deleteByToken(any()) }
        verify(exactly = 0) { notificationLogRepository.save(any()) }
    }
}
