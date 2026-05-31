package com.japanese.vocabulary.notification

import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingException
import com.google.firebase.messaging.Message
import com.google.firebase.messaging.MessagingErrorCode
import io.mockk.Runs
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.time.Instant

/**
 * Pure-mock verification of [PushNotificationService]. Confirms the candidate → send → log
 * pipeline on success, and the two invalid-token branches called out in AC-BATCH-7 step 5.
 *
 * Failure paths intentionally do NOT call `recordLog` — see the service docstring: we only
 * record FCM-accepted sends, failures live in the logs only.
 */
class PushNotificationServiceTest {

    private val firebaseMessaging: FirebaseMessaging = mockk()
    private val dataAccess: PushNotificationDataAccess = mockk(relaxed = true)
    private val service = PushNotificationService(dataAccess, firebaseMessaging)

    private val now: Instant = Instant.parse("2026-06-01T09:00:00Z")

    private fun candidate(
        userId: Long = 7L,
        token: String = "tok-${userId}",
        flashcardId: Long = 42L,
        wordSurface: String = "勉強",
        platform: String = "ANDROID",
    ) = NotificationCandidate(userId, token, platform, flashcardId, wordSurface)

    private fun fcmError(code: MessagingErrorCode): FirebaseMessagingException {
        // NOT relaxed: logback's ThrowableProxy walks getCause() recursively, and a relaxed
        // mockk returns a new child mock for every getCause() call → StackOverflow.
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
    fun `sendReviewReminders sends FCM message per candidate and logs title and body`() {
        val c = candidate()
        every { dataAccess.findCandidates(now) } returns listOf(c)
        val sentMessage = slot<Message>()
        every { firebaseMessaging.send(capture(sentMessage)) } returns "fcm-msg-id"
        val titleSlot = slot<String>()
        val bodySlot = slot<String>()
        every {
            dataAccess.recordLog(any(), any(), capture(titleSlot), capture(bodySlot))
        } just Runs

        val result = service.sendReviewReminders(now)

        assertThat(result.sent).isEqualTo(1)
        assertThat(result.failed).isEqualTo(0)
        verify(exactly = 1) { firebaseMessaging.send(any<Message>()) }
        verify(exactly = 1) {
            dataAccess.recordLog(
                userId = c.userId,
                sentAt = any(),
                title = any(),
                body = any(),
            )
        }
        assertThat(titleSlot.captured).isEqualTo("${c.wordSurface}, 이 단어 기억나시나요?")
        assertThat(bodySlot.captured).isEqualTo("잊어버리기 전에 잠깐 들러보세요.")
        verify(exactly = 0) { dataAccess.deleteInvalidToken(any()) }
    }

    @Test
    fun `UNREGISTERED FCM error deletes the invalid token and writes no log row`() {
        val c = candidate(userId = 11L, token = "stale-token")
        every { dataAccess.findCandidates(now) } returns listOf(c)
        every { firebaseMessaging.send(any<Message>()) } throws fcmError(MessagingErrorCode.UNREGISTERED)
        every { dataAccess.deleteInvalidToken("stale-token") } just Runs

        val result = service.sendReviewReminders(now)

        assertThat(result.sent).isEqualTo(0)
        assertThat(result.failed).isEqualTo(1)
        verify(exactly = 1) { dataAccess.deleteInvalidToken("stale-token") }
        verify(exactly = 0) { dataAccess.recordLog(any(), any(), any(), any()) }
    }

    @Test
    fun `INVALID_ARGUMENT FCM error does NOT delete token and writes no log row`() {
        val c = candidate(userId = 13L, token = "still-valid-token")
        every { dataAccess.findCandidates(now) } returns listOf(c)
        every { firebaseMessaging.send(any<Message>()) } throws fcmError(MessagingErrorCode.INVALID_ARGUMENT)

        val result = service.sendReviewReminders(now)

        assertThat(result.sent).isEqualTo(0)
        assertThat(result.failed).isEqualTo(1)
        verify(exactly = 0) { dataAccess.deleteInvalidToken(any()) }
        verify(exactly = 0) { dataAccess.recordLog(any(), any(), any(), any()) }
    }
}
